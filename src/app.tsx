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
  const [route, setRoute] = useState<Route>("editor");
  const [target, setTarget] = useState<Target | null>(null);
  const [refresh, setRefresh] = useState(0);

  // Resolve the landing buffer: an explicit CLI file, else resume today's
  // session if it exists, else start a fresh one.
  useEffect(() => {
    (async () => {
      if (file) {
        setTarget({ filename: file, isNew: false, autoplay: true });
        return;
      }
      const todays = `${today()}.dough`;
      const exists = await Bun.file(join(SESSIONS_DIR, todays)).exists();
      setTarget({ filename: todays, isNew: !exists });
    })();
  }, [file]);

  async function newSession() {
    setTarget({ filename: await uniqueName(), isNew: true });
    setRoute("editor");
  }

  if (!target) return <Text color="gray">…</Text>;

  if (route === "browser") {
    return (
      <Browser
        refresh={refresh}
        onOpen={f => { setTarget({ filename: f, isNew: false }); setRoute("editor"); }}
        onNew={newSession}
        onBack={() => setRoute("editor")}
        onQuit={() => { dough.hush(); exit(); }}
      />
    );
  }

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
