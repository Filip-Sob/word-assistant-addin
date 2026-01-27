import React, { useState } from "react";

type AppProps = {
  title: string;
};

type Mode = "REWRITE" | "EXPLAIN";

type AssistResponse = {
  answer: string;
};

const API_URL = "http://localhost:8080/api/assist";

// === UI COLORS (Word-like) ===
const BLUE = "#185ABD";
const GRAY = "#E6E6E6";
const BORDER = "#C8C8C8";
const TEXT_DARK = "#111";

// === BASE BUTTON STYLES ===
const btnBase: React.CSSProperties = {
  borderRadius: 10,
  padding: "10px 12px",
  border: `1px solid ${BORDER}`,
  cursor: "pointer",
  fontFamily: "Segoe UI, sans-serif",
};

const btnToggle: React.CSSProperties = {
  ...btnBase,
  flex: 1,
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: GRAY,
  fontWeight: 600,
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: BLUE,
  color: "white",
  border: "1px solid transparent",
  fontWeight: 700,
  fontSize: 16,
};

export default function App({ title }: AppProps) {
  const [mode, setMode] = useState<Mode>("REWRITE");
  const [contextText, setContextText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useSelection = async () => {
    setError(null);

    const selected = await Word.run(async (context) => {
      const range = context.document.getSelection();
      range.load("text");
      await context.sync();
      return (range.text || "").trim();
    });

    if (!selected) {
      setError("Zaznacz tekst w Wordzie i kliknij „Use selection”.");
      return;
    }

    setContextText(selected);
  };

  const runAssist = async () => {
    setLoading(true);
    setError(null);

    try {
      let ctx = contextText.trim();

      const liveSelection = await Word.run(async (context) => {
        const range = context.document.getSelection();
        range.load("text");
        await context.sync();
        return (range.text || "").trim();
      });

      if (liveSelection) {
        ctx = liveSelection;
      }

      const instr = instruction.trim();
      if (!instr) throw new Error("Wpisz polecenie.");

      if (mode === "EXPLAIN" && !ctx) {
        throw new Error("Tryb Explain wymaga zaznaczonego tekstu.");
      }

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextText: ctx,
          instruction: instr,
          mode: mode,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${body}`);
      }

      const data: AssistResponse = await res.json();
      const answer = data.answer?.trim();
      if (!answer) throw new Error("Pusta odpowiedź z backendu.");

      await Word.run(async (context) => {
        const range = context.document.getSelection();
        range.load("text");
        await context.sync();

        if (mode === "REWRITE") {
          range.insertText(answer, Word.InsertLocation.replace);
        } else {
          range.insertParagraph("--- Assistant (Explain) ---", Word.InsertLocation.after);
          range.insertParagraph(answer, Word.InsertLocation.after);
        }

        await context.sync();
      });
    } catch (e: any) {
      setError(e.message ?? "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>

      {/* MODE TOGGLE */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setMode("REWRITE")}
          disabled={loading}
          style={{
            ...btnToggle,
            background: mode === "REWRITE" ? BLUE : GRAY,
            color: mode === "REWRITE" ? "white" : TEXT_DARK,
            borderColor: mode === "REWRITE" ? BLUE : BORDER,
            opacity: loading ? 0.7 : 1,
          }}
        >
          Rewrite
        </button>

        <button
          onClick={() => setMode("EXPLAIN")}
          disabled={loading}
          style={{
            ...btnToggle,
            background: mode === "EXPLAIN" ? BLUE : GRAY,
            color: mode === "EXPLAIN" ? "white" : TEXT_DARK,
            borderColor: mode === "EXPLAIN" ? BLUE : BORDER,
            opacity: loading ? 0.7 : 1,
          }}
        >
          Explain
        </button>
      </div>

      {/* USE SELECTION */}
      <button
        onClick={useSelection}
        disabled={loading}
        style={{
          ...btnSecondary,
          width: "100%",
          marginBottom: 10,
          opacity: loading ? 0.7 : 1,
        }}
      >
        Use selection
      </button>

      {/* INSTRUCTION */}
<textarea
  value={instruction}
  onChange={(e) => setInstruction(e.target.value)}
  disabled={loading}
  rows={4}
  style={{
    width: "100%",
    padding: 10,
    resize: "vertical",
    boxSizing: "border-box",   // 🔑 TO JEST KLUCZ
    marginTop: 6,
    borderRadius: 10,
    border: "1px solid #C8C8C8",
    fontFamily: "Segoe UI, sans-serif",
  }}
  placeholder={
    mode === "REWRITE"
      ? "Np. popraw styl, skróć, wygeneruj nowy tekst…"
      : "Np. zinterpretuj w 5 zdaniach…"
  }
/>


      {/* RUN ASSIST */}
      <button
        onClick={runAssist}
        disabled={loading}
        style={{
          ...btnPrimary,
          width: "100%",
          marginTop: 10,
          opacity: loading ? 0.85 : 1,
        }}
      >
        {loading ? "Working..." : "Run Assist"}
      </button>

      {error && (
        <div style={{ marginTop: 12, color: "crimson" }}>
          <b>Błąd:</b> {error}
        </div>
      )}
    </div>
  );
}
