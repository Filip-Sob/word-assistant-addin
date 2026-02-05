import React, { useMemo, useState } from "react";
import { getOrCreateClientId } from "../utils/clientId";

type AppProps = {
  title: string;
};

type Mode = "REWRITE" | "EXPLAIN" | "DOCUMENT";
type Tab = "ASSISTANT" | "HISTORY";

type Scope = "SELECTION" | "DOCUMENT" | "INSERTION";
type ActionType = "REWRITE" | "EXPLAIN" | "DOCUMENT" | "OTHER";

type AssistResponse = {
  logId: string;
  answer: string;
};

type AiActionLog = {
  id: string;
  createdAt: string;
  clientId: string;
  scope: string;
  actionType: string;
  prompt: string;
  inputText: string;
  outputText: string | null;
  status: "SUCCESS" | "ERROR";
  errorMessage: string | null;
};

const API_ASSIST_URL = "http://localhost:8080/api/assist";
const API_HISTORY_URL = "http://localhost:8080/api/history";

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

const iconBtn: React.CSSProperties = {
  ...btnBase,
  padding: "8px 10px",
  width: 44,
  background: GRAY,
  fontWeight: 800,
};

// ======= MAPOWANIA NA POLSKI (UI) =======
const statusLabel = (s: string) => {
  if (s === "SUCCESS") return "Sukces";
  if (s === "ERROR") return "Błąd";
  return s;
};

const scopeLabel = (s: string) => {
  switch (s) {
    case "SELECTION":
      return "Zaznaczenie";
    case "DOCUMENT":
      return "Dokument";
    case "INSERTION":
      return "Wstawienie";
    default:
      return s;
  }
};

const actionTypeLabel = (t: string) => {
  switch (t) {
    case "REWRITE":
      return "Przepisz";
    case "EXPLAIN":
      return "Wyjaśnij";
    case "DOCUMENT":
      return "Dokument";
    case "OTHER":
      return "Inne";
    default:
      return t;
  }
};

export default function App({ title }: AppProps) {
  const [tab, setTab] = useState<Tab>("ASSISTANT");

  const [mode, setMode] = useState<Mode>("REWRITE");
  const [contextText, setContextText] = useState("");
  const [instruction, setInstruction] = useState("");

  // Global 1-step document snapshots (Undo/Redo) for ALL operations
  const [undoDoc, setUndoDoc] = useState<string | null>(null);
  const [redoDoc, setRedoDoc] = useState<string | null>(null);
  const [docState, setDocState] = useState<"AFTER" | "BEFORE" | null>(null);

  const canUndo = useMemo(() => !!undoDoc && docState === "AFTER", [undoDoc, docState]);
  const canRedo = useMemo(() => !!redoDoc && docState === "BEFORE", [redoDoc, docState]);

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<AiActionLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AiActionLog | null>(null);

  // limit historii + dropdown
  const [historyLimit, setHistoryLimit] = useState<number>(30);

  const infoText =
    "Tryby działania:\n" +
    "• Przepisz: modyfikuje zaznaczony tekst i zastępuje go.\n" +
    "• Wyjaśnij: dodaje analizę/komentarz poniżej zaznaczenia (oryginał zostaje).\n" +
    "• Dokument: działa na całym dokumencie (zastępuje całą treść).";

  const readWholeDocument = async (): Promise<string> => {
    return await Word.run(async (context) => {
      const body = context.document.body;
      body.load("text");
      await context.sync();
      return (body.text || "").trim();
    });
  };

  const replaceWholeDocument = async (text: string) => {
    await Word.run(async (context) => {
      const body = context.document.body;
      body.insertText(text, Word.InsertLocation.replace);
      await context.sync();
    });
  };

  const captureSnapshots = async (before: string) => {
    const after = await readWholeDocument();
    setUndoDoc(before);
    setRedoDoc(after);
    setDocState("AFTER");
  };

  const useSelection = async () => {
    setError(null);

    const selected = await Word.run(async (context) => {
      const range = context.document.getSelection();
      range.load("text");
      await context.sync();
      return (range.text || "").trim();
    });

    if (!selected) {
      setError("Zaznacz tekst w Wordzie i kliknij „Użyj zaznaczenia”.");
      return;
    }

    setContextText(selected);
  };

  // jedna funkcja z limitem
  const loadHistoryWithLimit = async (limit: number) => {
    const clientId = getOrCreateClientId();
    setHistoryLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_HISTORY_URL}?clientId=${encodeURIComponent(clientId)}&limit=${limit}`
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HISTORIA ${res.status}: ${body}`);
      }
      const data: AiActionLog[] = await res.json();
      setHistory(data);
      setSelectedLog(data[0] ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Nieznany błąd");
    } finally {
      setHistoryLoading(false);
    }
  };

  // alias
  const loadHistory = async () => {
    await loadHistoryWithLimit(historyLimit);
  };

  // czyszczenie historii (DELETE)
  const [confirmClear, setConfirmClear] = useState(false);

const clearHistory = async () => {
  const clientId = getOrCreateClientId();
  setHistoryLoading(true);
  setError(null);

  try {
    const res = await fetch(`${API_HISTORY_URL}?clientId=${encodeURIComponent(clientId)}`, {
      method: "DELETE",
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`CZYSZCZENIE HISTORII ${res.status}: ${text}`);
    }

    // opcjonalnie: pokaż ile usunęło
    // console.log("DELETE response:", text);

    setHistory([]);
    setSelectedLog(null);
    setConfirmClear(false);

    // dla pewności: odśwież listę z serwera
    await loadHistory();
  } catch (e: any) {
    setError(e?.message ?? "Nieznany błąd");
  } finally {
    setHistoryLoading(false);
  }
};


  const runAssist = async () => {
    setLoading(true);
    setError(null);

    try {
      const instr = instruction.trim();
      if (!instr) throw new Error("Wpisz polecenie.");

      const clientId = getOrCreateClientId();
      const scope: Scope = mode === "DOCUMENT" ? "DOCUMENT" : "SELECTION";
      const actionType: ActionType = mode;

      // snapshot BEFORE (global)
      const beforeDoc = await readWholeDocument();

      // build context for backend
      let ctx = "";

      if (mode === "DOCUMENT") {
        // Dokument może być pusty – wtedy generujemy treść od zera
        ctx = beforeDoc ?? "";
      } else {
        ctx = contextText.trim();

        const liveSelection = await Word.run(async (context) => {
          const range = context.document.getSelection();
          range.load("text");
          await context.sync();
          return (range.text || "").trim();
        });

        if (liveSelection) ctx = liveSelection;

        if (mode === "EXPLAIN" && !ctx) {
          throw new Error("Tryb „Wyjaśnij” wymaga zaznaczonego tekstu.");
        }
      }

      // call backend
      const res = await fetch(API_ASSIST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          scope,
          actionType,
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
      const raw = data.answer ?? "";
      const answer = raw.trim();

      // Wyjaśnij musi mieć treść, ale Przepisz/Dokument mogą legalnie zwrócić pusty tekst (delete)
      if (!answer && mode === "EXPLAIN") {
        throw new Error("Pusta odpowiedź z backendu.");
      }

      // apply to Word depending on mode
      if (mode === "DOCUMENT") {
        await replaceWholeDocument(raw);
      } else {
        await Word.run(async (context) => {
          const range = context.document.getSelection();
          range.load("text");
          await context.sync();

          if (mode === "REWRITE") {
            range.insertText(raw, Word.InsertLocation.replace);
          } else {
            
            range.insertParagraph(raw, Word.InsertLocation.after);
          }

          await context.sync();
        });
      }

      // snapshot AFTER (global)
      await captureSnapshots(beforeDoc);

      // optional: refresh history silently if user is on History tab
      if (tab === "HISTORY") {
        await loadHistory();
      }
    } catch (e: any) {
      setError(e?.message ?? "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  };

  const undo = async () => {
    if (loading || historyLoading || !canUndo || !undoDoc) return;
    setLoading(true);
    setError(null);
    try {
      await replaceWholeDocument(undoDoc);
      setDocState("BEFORE");
    } catch (e: any) {
      setError(e?.message ?? "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  };

  const redo = async () => {
    if (loading || historyLoading || !canRedo || !redoDoc) return;
    setLoading(true);
    setError(null);
    try {
      await replaceWholeDocument(redoDoc);
      setDocState("AFTER");
    } catch (e: any) {
      setError(e?.message ?? "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  };

  const contextPreview = contextText.length > 220 ? contextText.slice(0, 220) + "…" : contextText;

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, sans-serif", position: "relative" }}>
      {/* Header row with global info "i" */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>{title}</h2>

        <button
          type="button"
          title={infoText}
          style={{
            border: `1px solid ${BORDER}`,
            background: "white",
            color: TEXT_DARK,
            borderRadius: 999,
            width: 26,
            height: 26,
            fontWeight: 800,
            cursor: "help",
            lineHeight: "24px",
            textAlign: "center",
            padding: 0,
          }}
        >
          i
        </button>
      </div>

      {/* MAIN TAB TOGGLE */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setTab("ASSISTANT")}
          disabled={loading || historyLoading}
          style={{
            ...btnToggle,
            background: tab === "ASSISTANT" ? BLUE : GRAY,
            color: tab === "ASSISTANT" ? "white" : TEXT_DARK,
            borderColor: tab === "ASSISTANT" ? BLUE : BORDER,
            opacity: loading || historyLoading ? 0.7 : 1,
          }}
        >
          Asystent
        </button>

        <button
          onClick={async () => {
            setTab("HISTORY");
            await loadHistory();
          }}
          disabled={loading || historyLoading}
          style={{
            ...btnToggle,
            background: tab === "HISTORY" ? BLUE : GRAY,
            color: tab === "HISTORY" ? "white" : TEXT_DARK,
            borderColor: tab === "HISTORY" ? BLUE : BORDER,
            opacity: loading || historyLoading ? 0.7 : 1,
          }}
        >
          Historia
        </button>
      </div>

      {/* ===================== ASSISTANT TAB ===================== */}
      {tab === "ASSISTANT" && (
        <>
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
              Przepisz
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
              Wyjaśnij
            </button>

            <button
              onClick={() => setMode("DOCUMENT")}
              disabled={loading}
              style={{
                ...btnToggle,
                background: mode === "DOCUMENT" ? BLUE : GRAY,
                color: mode === "DOCUMENT" ? "white" : TEXT_DARK,
                borderColor: mode === "DOCUMENT" ? BLUE : BORDER,
                opacity: loading ? 0.7 : 1,
              }}
            >
              Dokument
            </button>
          </div>

          {/* USE SELECTION */}
          <button
            onClick={useSelection}
            disabled={loading || mode === "DOCUMENT"}
            style={{
              ...btnSecondary,
              width: "100%",
              marginBottom: 10,
              opacity: loading || mode === "DOCUMENT" ? 0.6 : 1,
              cursor: loading || mode === "DOCUMENT" ? "default" : "pointer",
            }}
            title={mode === "DOCUMENT" ? "Tryb dokumentu pobiera cały dokument" : "Ustaw kontekst na podstawie zaznaczenia"}
          >
            Użyj zaznaczenia
          </button>

          {/* CONTEXT PREVIEW */}
          {mode !== "DOCUMENT" && contextText.trim().length > 0 && (
            <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.85 }}>
              <b>Kontekst:</b>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{contextPreview}</div>
              <button
                onClick={() => setContextText("")}
                disabled={loading}
                style={{
                  ...btnSecondary,
                  marginTop: 6,
                  padding: "6px 10px",
                  borderRadius: 10,
                }}
              >
                Wyczyść kontekst
              </button>
            </div>
          )}

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
              boxSizing: "border-box",
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              fontFamily: "Segoe UI, sans-serif",
            }}
            placeholder={
              mode === "DOCUMENT"
                ? "Np. sprawdź spójność terminologiczną / zaproponuj streszczenie / popraw strukturę akapitów…"
                : mode === "REWRITE"
                ? "Np. popraw styl, skróć, wygeneruj nowy tekst…"
                : "Np. zinterpretuj w 5 zdaniach…"
            }
          />

          {/* RUN */}
          <button
            onClick={runAssist}
            disabled={loading}
            style={{
              ...btnPrimary,
              width: "100%",
              marginTop: 10,
              opacity: loading ? 0.85 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Przetwarzanie..." : "Uruchom"}
          </button>

          {error && (
            <div style={{ marginTop: 12, color: "crimson" }}>
              <b>Błąd:</b> {error}
            </div>
          )}

          {/* Global arrows (Undo / Redo) */}
          <div
            style={{
              position: "sticky",
              bottom: 0,
              marginTop: 12,
              paddingTop: 10,
              display: "flex",
              gap: 10,
              justifyContent: "flex-start",
              background: "transparent",
            }}
          >
            <button
              onClick={undo}
              disabled={loading || !canUndo}
              title="Cofnij (przywróć poprzedni stan dokumentu)"
              style={{
                ...iconBtn,
                opacity: loading || !canUndo ? 0.4 : 1,
                fontSize: "24px",
                fontWeight: 900,
                cursor: loading || !canUndo ? "default" : "pointer",
              }}
            >
              ←
            </button>

            <button
              onClick={redo}
              disabled={loading || !canRedo}
              title="Ponów (przywróć kolejny stan dokumentu)"
              style={{
                ...iconBtn,
                opacity: loading || !canRedo ? 0.4 : 1,
                fontSize: "24px",
                fontWeight: 900,
                cursor: loading || !canRedo ? "default" : "pointer",
              }}
            >
              →
            </button>
          </div>
        </>
      )}

      {/* ===================== HISTORY TAB ===================== */}
      {tab === "HISTORY" && (
        <div>
          {/* REFRESH + CLEAR */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              style={{ ...btnSecondary, width: "100%" }}
            >
              {historyLoading ? "Wczytywanie..." : "Odśwież historię"}
            </button>

            <button
            onClick={async () => {
              if (!confirmClear) {
                setConfirmClear(true);
                // po 4s wraca do normalnego stanu
                setTimeout(() => setConfirmClear(false), 4000);
                return;
              }
              await clearHistory();
            }}
            disabled={historyLoading}
            style={{
              ...btnSecondary,
              width: "100%",
              borderColor: "#b00020",
              color: "#b00020",
              fontWeight: 700,
            }}
            title="Usuń wszystkie wpisy historii dla tego klienta"
          >
            {confirmClear ? "Kliknij ponownie, aby potwierdzić" : "Wyczyść historię"}
          </button>
          </div>

          {/* dropdown limitu */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Pokaż wpisy:</div>

            <select
              value={historyLimit}
              disabled={historyLoading}
              onChange={async (e) => {
                const limit = Number(e.target.value);
                setHistoryLimit(limit);
                await loadHistoryWithLimit(limit);
              }}
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                fontFamily: "Segoe UI, sans-serif",
                background: "white",
              }}
            >
              <option value={10}>10</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>

          {error && (
            <div style={{ marginTop: 12, marginBottom: 10, color: "crimson" }}>
              <b>Błąd:</b> {error}
            </div>
          )}

          {history.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              Brak wpisów historii dla tego klienta. Uruchom jakąś akcję w zakładce Asystent.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              {/* LISTA */}
              <div style={{ flex: 1, maxWidth: 160 }}>
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setSelectedLog(h)}
                    style={{
                      ...btnSecondary,
                      width: "100%",
                      marginBottom: 8,
                      background: selectedLog?.id === h.id ? BLUE : GRAY,
                      color: selectedLog?.id === h.id ? "white" : TEXT_DARK,
                      borderColor: selectedLog?.id === h.id ? BLUE : BORDER,
                    }}
                    title={`${actionTypeLabel(h.actionType)} • ${statusLabel(h.status)}`}
                  >
                    {new Date(h.createdAt).toLocaleString()}
                  </button>
                ))}
              </div>

              {/* SZCZEGÓŁY */}
              <div style={{ flex: 2, fontSize: 13 }}>
                {selectedLog && (
                  <>
                    <div>
                      <b>Status:</b> {statusLabel(selectedLog.status)}
                    </div>
                    <div>
                      <b>Tryb/Typ:</b> {actionTypeLabel(selectedLog.actionType)}
                    </div>
                    <div>
                      <b>Zakres:</b> {scopeLabel(selectedLog.scope)}
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <b>Polecenie:</b>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          border: `1px solid ${BORDER}`,
                          borderRadius: 10,
                          padding: 8,
                        }}
                      >
                        {selectedLog.prompt}
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <b>Tekst źródłowy:</b>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          border: `1px solid ${BORDER}`,
                          borderRadius: 10,
                          padding: 8,
                        }}
                      >
                        {selectedLog.inputText}
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <b>Wynik:</b>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          border: `1px solid ${BORDER}`,
                          borderRadius: 10,
                          padding: 8,
                        }}
                      >
                        {selectedLog.outputText ?? ""}
                      </div>
                    </div>

                    {selectedLog.errorMessage && (
                      <div style={{ marginTop: 10, color: "crimson" }}>
                        <b>Błąd:</b> {selectedLog.errorMessage}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
