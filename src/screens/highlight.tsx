import { Text } from "ink";
import type { ReactNode } from "react";

// Syntax highlighting for .dough lines. A line is either a `--` comment or a
// sequence of `/key/value/key/value…` fields. We tokenise into coloured spans
// that cover every character exactly (so the editor's cursor column still maps
// 1:1 onto the rendered text), then render — optionally overlaying an inverse
// block cursor at a given column.

type Span = { text: string; color?: string };

// dough oscillator/source names — worth their own colour as the one "word"
// value you tend to scan for.
const SOUNDS = new Set(["saw", "sine", "tri", "pulse", "zaw", "square", "noise"]);

const NUMERIC = /^-?(?:\d+\.?\d*|\.\d+)$/;

function spansFor(line: string): Span[] {
  if (line.trimStart().startsWith("--")) return [{ text: line, color: "gray" }];

  const spans: Span[] = [];
  const parts = line.split("/");
  let field = 0; // counts non-empty segments: even = key, odd = value
  for (let p = 0; p < parts.length; p++) {
    if (p > 0) spans.push({ text: "/", color: "gray" });
    const seg = parts[p];
    if (!seg.length) continue;
    let color: string;
    if (field % 2 === 0) color = "cyan"; // key
    else if (SOUNDS.has(seg)) color = "magenta"; // sound value
    else if (NUMERIC.test(seg)) color = "yellow"; // numeric value
    else color = "white"; // other value
    spans.push({ text: seg, color });
    field++;
  }
  return spans;
}

export function renderLine(line: string, cursor?: number): ReactNode {
  const spans = spansFor(line);
  const out: ReactNode[] = [];
  let col = 0;
  let k = 0;

  for (const span of spans) {
    const len = span.text.length;
    if (cursor == null || cursor < col || cursor >= col + len) {
      out.push(
        <Text key={k++} color={span.color}>
          {span.text}
        </Text>
      );
    } else {
      const at = cursor - col;
      const before = span.text.slice(0, at);
      const after = span.text.slice(at + 1);
      if (before)
        out.push(
          <Text key={k++} color={span.color}>
            {before}
          </Text>
        );
      out.push(
        <Text key={k++} inverse>
          {span.text[at] ?? " "}
        </Text>
      );
      if (after)
        out.push(
          <Text key={k++} color={span.color}>
            {after}
          </Text>
        );
    }
    col += len;
  }

  if (cursor != null && cursor >= col) {
    out.push(
      <Text key={k++} inverse>
        {" "}
      </Text>
    ); // cursor at end of line (or on an empty line)
  } else if (out.length === 0) {
    out.push(<Text key={k++}> </Text>); // empty line, no cursor here
  }

  return <Text>{out}</Text>;
}
