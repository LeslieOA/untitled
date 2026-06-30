import { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { join } from "path";

const SESSIONS_DIR = join(import.meta.dir, "../../sessions");

export default function Browser({
  onOpen,
  onNew,
  onBack,
  onQuit,
  refresh,
  canGoBack = true,
}: {
  onOpen: (filename: string) => void;
  onNew: () => void;
  onBack: () => void;
  onQuit: () => void;
  refresh: number; // bump to re-scan after a save
  canGoBack?: boolean; // false when the browser is the launch screen (no editor behind it)
}) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    (async () => {
      const glob = new Bun.Glob("*.{dough,js,tidal}");
      const found = await Array.fromAsync(glob.scan(SESSIONS_DIR));
      setFiles(found.sort().reverse()); // newest first
    })();
  }, [refresh]);

  useInput((input, key) => {
    if (input === "q") return onQuit();
    if (key.escape) return canGoBack ? onBack() : undefined;
    if (input === "n") return onNew();
    if (key.upArrow || input === "k") setSelected(s => Math.max(0, s - 1));
    if (key.downArrow || input === "j") setSelected(s => Math.min(files.length - 1, s + 1));
    if (key.return && files[selected]) onOpen(files[selected]);
  });

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Box gap={2}>
        <Text bold color="cyan">generative</Text>
        <Text color="gray">sessions</Text>
      </Box>

      <Box flexDirection="column">
        {files.length === 0 && <Text color="gray">no sessions yet — press n to start one</Text>}
        {files.map((f, i) => {
          const isSelected = i === selected;
          return (
            <Box key={f} gap={1}>
              <Text color={isSelected ? "cyan" : "gray"}>{isSelected ? "›" : " "}</Text>
              <Text color={isSelected ? "white" : "gray"}>{f}</Text>
            </Box>
          );
        })}
      </Box>

      <Box gap={3} marginTop={1}>
        <Text color="gray">↑↓/jk navigate</Text>
        <Text color="green">↵ open</Text>
        <Text color="cyan">n new</Text>
        {canGoBack && <Text color="gray">esc editor</Text>}
        <Text color="gray">q quit</Text>
      </Box>
    </Box>
  );
}
