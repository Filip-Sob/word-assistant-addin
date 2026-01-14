import * as React from "react";
import Header from "./Header";
import HeroList, { HeroListItem } from "./HeroList";
import TextInsertion from "./TextInsertion";
import { makeStyles, Button } from "@fluentui/react-components";
import { Ribbon24Regular, LockOpen24Regular, DesignIdeas24Regular } from "@fluentui/react-icons";
import { insertText, getSelectedText, insertTextAfterSelection } from "../taskpane";

interface AppProps {
  title: string;
}

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
  },
});

const App: React.FC<AppProps> = (props: AppProps) => {
  const styles = useStyles();

  // ===== MVP: Word -> Spring (/api/assist) -> Word =====
  const runAssist = async () => {
    console.log("Run Assist clicked");

    try {
      const selectedText = await getSelectedText();

      if (!selectedText || !selectedText.trim()) {
        console.log("Brak zaznaczonego tekstu.");
        return;
      }

      const res = await fetch("http://localhost:8080/api/assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: selectedText }),
      });

      if (!res.ok) {
        console.error("Assist API error:", res.status, res.statusText);
        return;
      }

      const data = (await res.json()) as { result: string };

      await insertTextAfterSelection(data.result);
      console.log("Run Assist: odpowiedź wstawiona do dokumentu.");
    } catch (e) {
      console.error("Run Assist error:", e);
    }
  };

  // --- DEBUG (zostawiamy zakomentowane na przyszłość) ---
  /*
  const testApi = async () => {
    console.log("Test API clicked");

    try {
      const res = await fetch("http://localhost:8080/api/ping");
      const text = await res.text();
      console.log("API response:", text);
    } catch (e) {
      console.error("API connection error:", e);
    }
  };

  const testSelection = async () => {
    try {
      const text = await getSelectedText();
      console.log("Selected text from Word:", text);
    } catch (e) {
      console.error("Error reading selection from Word:", e);
    }
  };
  */

  const listItems: HeroListItem[] = [
    { icon: <Ribbon24Regular />, primaryText: "Achieve more with Office integration" },
    { icon: <LockOpen24Regular />, primaryText: "Unlock features and functionality" },
    { icon: <DesignIdeas24Regular />, primaryText: "Create and visualize like a pro" },
  ];

  return (
    <div className={styles.root}>
      <Header logo="assets/logo-filled.png" title={props.title} message="Welcome" />
      <HeroList message="Discover what this add-in can do for you today!" items={listItems} />
      <TextInsertion insertText={insertText} />

      <Button appearance="primary" onClick={runAssist}>
        Run Assist
      </Button>

      {/* DEBUG BUTTONS (wyłączone na wersję MVP) */}
      {/*
      <Button appearance="primary" onClick={testApi}>
        Test API
      </Button>

      <Button appearance="secondary" onClick={testSelection}>
        Test Selection
      </Button>
      */}
    </div>
  );
};

export default App;
