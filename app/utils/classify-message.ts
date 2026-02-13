/**
 * Shared message classification for JSONL session entries.
 * Extracted from session detail route for reuse in search.
 */

/** Classify a parsed JSONL entry into a category key like "assistant|message" */
export function classifyMessage(v: any): string {
  const top: string = (v?.type as string) || "unknown";

  if (top === "summary" && !v?.message) return "summary";

  const c = v?.message?.content;
  const segs: any[] = Array.isArray(c) ? c : c ? [c] : [];

  const tu = segs.find((s) => s && s.type === "tool_use");
  if (tu) {
    return tu.name === "TodoWrite" ? `${top}|tool_use|TodoWrite` : `${top}|tool_use`;
  }

  if (segs.find((s) => s && s.type === "tool_result")) return `${top}|tool_result`;
  if (segs.find((s) => s && s.type === "thinking")) return `${top}|thinking`;
  if (segs.find((s) => typeof s === "string" || (s && s.type === "text"))) return `${top}|message`;

  return `${top}|entry`;
}

/** Get a human-readable label for a classification key */
export function classifyLabel(key: string): string {
  if (key === "summary") return "summary";
  if (key === "invalid") return "invalid";
  if (key.endsWith("|tool_use|TodoWrite")) return "TodoWrite";
  if (key.endsWith("|tool_use")) return "tool use";
  if (key.endsWith("|tool_result")) return "tool result";
  if (key.endsWith("|thinking")) return "thinking";
  if (key.endsWith("|entry")) return key.split("|")[0];
  if (key.endsWith("|message")) return key.split("|")[0];
  return key;
}

/**
 * Extract searchable text from a JSONL entry.
 * Always includes text + thinking content.
 * When includeToolContent=true, also includes tool_use inputs and tool_result content.
 */
export function extractSearchableText(entry: any, includeToolContent: boolean): string {
  const parts: string[] = [];

  const c = entry?.message?.content;
  const segs: any[] = Array.isArray(c) ? c : c ? [c] : [];

  for (const seg of segs) {
    if (typeof seg === "string") {
      parts.push(seg);
      continue;
    }
    if (!seg) continue;

    if (seg.type === "text" && seg.text) {
      parts.push(seg.text);
    } else if (seg.type === "thinking" && seg.thinking) {
      parts.push(seg.thinking);
    } else if (includeToolContent) {
      if (seg.type === "tool_use" && seg.input) {
        parts.push(typeof seg.input === "string" ? seg.input : JSON.stringify(seg.input));
      } else if (seg.type === "tool_result") {
        const rc = seg.content;
        if (typeof rc === "string") {
          parts.push(rc);
        } else if (Array.isArray(rc)) {
          for (const item of rc) {
            if (typeof item === "string") parts.push(item);
            else if (item?.text) parts.push(item.text);
          }
        }
      }
    }
  }

  return parts.join("\n");
}
