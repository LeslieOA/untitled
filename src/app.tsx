import { useState, useEffect } from "react";
import { useApp, Text } from "ink";
import { join } from "path";
import Editor from "./screens/Editor.tsx";
import Browser from "./screens/Browser.tsx";
import type { DoughProcess } from "./dough.ts";

const SESSIONS_DIR = join(import.meta.dir, "../sessions");

type Route = "editor" | "browser";
type Target = { filename: string; isNew: boolean; autoplay?: boolean };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function uniqueName(): Promise<string> {
  const date = today();
  let name = `${date}.dough`;
  let i = 2;
  while (await Bun.file(join(SESSIONS_DIR, name)).exists()) {
    name = `${date}-${i}.dough`;
    i++;
  }
  return name;
}

export default function App({ dough, file }: { dough: DoughProcess; file?: string }) {
  const { exit } = useApp();
  // Launched with a file → straight to the editor; launched bare → land on the
  // session browser (file-selection screen).
  const [route, setRoute] = useState<Route>(file ? "editor" : "browser");
  const [target, setTarget] = useState<Target | null>(null);
  const [refresh, setRefresh] = useState(0);

  // An explicit CLI file opens (and auto-plays) in the editor. Without one we
  // stay on the browser with no target until the user picks or creates a session.
  useEffect(() => {
    if (file) setTarget({ filename: file, isNew: false, autoplay: true });
  }, [file]);

  async function newSession() {
    setTarget({ filename: await uniqueName(), isNew: true });
    setRoute("editor");
  }

  if (route === "browser") {
    return (
      <Browser
        refresh={refresh}
        canGoBack={!!target}
        onOpen={f => { setTarget({ filename: f, isNew: false }); setRoute("editor"); }}
        onNew={newSession}
        onBack={() => { if (target) setRoute("editor"); }}
        onQuit={() => { dough.hush(); exit(); }}
      />
    );
  }

  if (!target) return <Text color="gray">…</Text>;

  return (
    <Editor
      dough={dough}
      filename={target.filename}
      isNew={target.isNew}
      autoplay={target.autoplay}
      onBrowse={() => setRoute("browser")}
      onSaved={() => {
        setTarget(t => (t ? { ...t, isNew: false } : t));
        setRefresh(r => r + 1);
      }}
    />
  );
}
