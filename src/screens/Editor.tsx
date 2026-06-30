import { useEffect, useReducer, useState } from "react";
import { Box, Text, useInput } from "ink";
import { join } from "path";
import { playText, type DoughProcess } from "../dough.ts";

const SESSIONS_DIR = join(import.meta.dir, "../../sessions");

const TEMPLATE = `-- new session · Ctrl+E to play · Ctrl+S to save
/time/0/duration/2/repeat/8/note/57/lpf/1100/lpe/1/lpd/0.5/lpq/0.1/s/saw`;

// ── editor buffer: lines + cursor, driven by a reducer ─────────────────────────

type EState = { lines: string[]; cy: number; cx: number };
type EAction =
  | { t: "load"; lines: string[] }
  | { t: "insert"; s: string }
  | { t: "newline" }
  | { t: "backspace" }
  | { t: "left" } | { t: "right" } | { t: "up" } | { t: "down" }
  | { t: "home" } | { t: "end" };

function reducer(s: EState, a: EAction): EState {
  const { lines, cy, cx } = s;
  const line = lines[cy] ?? "";
  switch (a.t) {
    case "load":
      return { lines: a.lines.length ? a.lines : [""], cy: 0, cx: 0 };
    case "insert": {
      const parts = a.s.split("\n");
      const before = line.slice(0, cx);
      const after = line.slice(cx);
      if (parts.length === 1) {
        const nl = [...lines];
        nl[cy] = before + a.s + after;
        return { lines: nl, cy, cx: cx + a.s.length };
      }
      const last = parts[parts.length - 1] ?? "";
      const block = [
        before + (parts[0] ?? ""),
        ...parts.slice(1, -1),
        last + after,
      ];
      return {
        lines: [...lines.slice(0, cy), ...block, ...lines.slice(cy + 1)],
        cy: cy + parts.length - 1,
        cx: last.length,
      };
    }
    case "newline":
      return {
        lines: [...lines.slice(0, cy), line.slice(0, cx), line.slice(cx), ...lines.slice(cy + 1)],
        cy: cy + 1,
        cx: 0,
      };
    case "backspace": {
      if (cx > 0) {
        const nl = [...lines];
        nl[cy] = line.slice(0, cx - 1) + line.slice(cx);
        return { lines: nl, cy, cx: cx - 1 };
      }
      if (cy > 0) {
        const prev = lines[cy - 1] ?? "";
        return {
          lines: [...lines.slice(0, cy - 1), prev + line, ...lines.slice(cy + 1)],
          cy: cy - 1,
          cx: prev.length,
        };
      }
      return s;
    }
    case "left":
      if (cx > 0) return { ...s, cx: cx - 1 };
      if (cy > 0) return { ...s, cy: cy - 1, cx: (lines[cy - 1] ?? "").length };
      return s;
    case "right":
      if (cx < line.length) return { ...s, cx: cx + 1 };
      if (cy < lines.length - 1) return { ...s, cy: cy + 1, cx: 0 };
      return s;
    case "up":
      return cy > 0 ? { ...s, cy: cy - 1, cx: Math.min(cx, (lines[cy - 1] ?? "").length) } : { ...s, cx: 0 };
    case "down":
      return cy < lines.length - 1
        ? { ...s, cy: cy + 1, cx: Math.min(cx, (lines[cy + 1] ?? "").length) }
        : { ...s, cx: line.length };
    case "home":
      return { ...s, cx: 0 };
    case "end":
      return { ...s, cx: line.length };
  }
}

type Status = { text: string; colour: string };

export default function Editor({
  dough,
  filename,
  isNew,
  autoplay,
  onBrowse,
  onSaved,
}: {
  dough: DoughProcess;
  filename: string;
  isNew: boolean;
  autoplay?: boolean;
  onBrowse: () => void;
  onSaved: () => void;
}) {
  const [state, dispatch] = useReducer(reducer, { lines: [""], cy: 0, cx: 0 });
  const [status, setStatus] = useState<Status>({ text: "ready", colour: "gray" });
  const [name, setName] = useState(filename);

  // Load the file (or template for a new session).
  useEffect(() => {
    (async () => {
      if (isNew) {
        dispatch({ t: "load", lines: TEMPLATE.split("\n") });
      } else {
        try {
          const text = await Bun.file(join(SESSIONS_DIR, filename)).text();
          dispatch({ t: "load", lines: text.split("\n") });
          // Auto-play when opened from the CLI (`generative <file>`): play the
          // text we just loaded directly, so it doesn't race the reducer state.
          if (autoplay) {
            const n = playText(dough, text);
            setStatus({ text: `▶ playing · ${n} events`, colour: "green" });
          }
        } catch (e: any) {
          setStatus({ text: `✗ ${e.message}`, colour: "red" });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename, isNew]);

  function evaluate() {
    try {
      const n = playText(dough, state.lines.join("\n"));
      setStatus({ text: `▶ playing · ${n} events`, colour: "green" });
    } catch (e: any) {
      setStatus({ text: `✗ ${e.message}`, colour: "red" });
    }
  }

  async function save() {
    try {
      await Bun.write(join(SESSIONS_DIR, name), state.lines.join("\n"));
      setStatus({ text: `saved · sessions/${name}`, colour: "cyan" });
      onSaved();
    } catch (e: any) {
      setStatus({ text: `✗ ${e.message}`, colour: "red" });
    }
  }

  useInput((input, key) => {
    if (key.escape) return onBrowse();
    if (key.ctrl && input === "e") return evaluate();
    if (key.ctrl && input === "s") return void save();
    if (key.ctrl && input === "k") {
      dough.hush();
      return setStatus({ text: "hushed", colour: "yellow" });
    }
    if (key.ctrl) return; // swallow other ctrl combos (Ctrl+C still quits)

    if (key.return) return dispatch({ t: "newline" });
    if (key.backspace || key.delete) return dispatch({ t: "backspace" });
    if (key.leftArrow) return dispatch({ t: "left" });
    if (key.rightArrow) return dispatch({ t: "right" });
    if (key.upArrow) return dispatch({ t: "up" });
    if (key.downArrow) return dispatch({ t: "down" });
    if (input) dispatch({ t: "insert", s: input });
  });

  const gutterWidth = String(state.lines.length).length;

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box gap={2} marginBottom={1}>
        <Text bold color="cyan">generative</Text>
        <Text color="white">{name}{isNew ? "*" : ""}</Text>
        <Text color={status.colour}>{status.text}</Text>
      </Box>

      {/* Code buffer */}
      <Box flexDirection="column">
        {state.lines.map((ln, i) => {
          const num = String(i + 1).padStart(gutterWidth, " ");
          const onCursorRow = i === state.cy;
          return (
            <Box key={i}>
              <Text color="gray">{num} </Text>
              {onCursorRow ? (
                <Text>
                  <Text>{ln.slice(0, state.cx)}</Text>
                  <Text inverse>{ln[state.cx] ?? " "}</Text>
                  <Text>{ln.slice(state.cx + 1)}</Text>
                </Text>
              ) : (
                <Text>{ln.length ? ln : " "}</Text>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      <Box gap={3} marginTop={1}>
        <Text color="green">^E play</Text>
        <Text color="cyan">^S save</Text>
        <Text color="yellow">^K hush</Text>
        <Text color="gray">esc browse</Text>
        <Text color="gray">^C quit</Text>
      </Box>
    </Box>
  );
}
