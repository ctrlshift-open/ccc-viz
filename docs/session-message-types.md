# Session Message Types Report (ergogen project)

- Source: `~/.claude/projects/<project>/*.jsonl`
- Scope: 2 session logs, 242 total JSONL entries
- Goal: Catalog top-level event types and message.content.type variants to drive UI templates

## Top-Level Event Types
- assistant: 143
- user: 97
- summary: 2

Notes:
- `summary` entries have no `message` object; they carry `summary` and `leafUuid` fields.
- `assistant` and `user` entries include a `message` object (see below).

## message.type
- message: 143
- null/absent: 99

Notes:
- Present for all `assistant` entries (type = `message`).
- Typically absent on `user` entries and on `summary` events (no `message`).

## message.content.type (by event type)
Assistant (143 total):
- text: 51
- thinking: 18
- tool_use: 74

User (97 total):
- tool_result: 74
- string (plain text content): 19
- image+text: 3 (content array with both `image` and `text` items)
- text (content array with a single `text`): 1

Summary (2 total):
- No `message`; fields are `{ type: "summary", summary: string, leafUuid: string }`.

## Tool Use and Results
- tool_use.name values (assistant):
  - Read: 31
  - Bash: 16
  - Grep: 9
  - Edit: 8
  - Glob: 5
  - WebSearch: 3
  - Task: 1
  - Write: 1

- tool_result fields (user):
  - Keys observed: `type`, `tool_use_id`, `content`, `is_error` (optional)
  - `is_error` present on 17 entries (true/false); use to visually flag failures
  - `content` is a string (often multi-line output or file content)

## Other Common Fields (header-level)
- Routing/trace: `uuid`, `parentUuid`, `leafUuid` (summary), `timestamp`
- Context: `cwd`, `sessionId`, `gitBranch`, `version`, `userType`, `isSidechain`
- Assistant metadata (when present): `message.id`, `message.model`, `message.usage.*`
  - Models observed: `claude-opus-4-1-20250805` (109), `claude-sonnet-4-20250514` (34)

## Representative Shapes
- assistant · text
  ```json
  {
    "type": "assistant",
    "message": {
      "type": "message",
      "role": "assistant",
      "model": "…",
      "content": [{ "type": "text", "text": "…" }]
    },
    "timestamp": "…"
  }
  ```

- assistant · tool_use
  ```json
  {
    "type": "assistant",
    "message": {
      "type": "message",
      "role": "assistant",
      "content": [{
        "type": "tool_use",
        "id": "toolu_…",
        "name": "Read" | "Bash" | "Grep" | …,
        "input": { … }
      }]
    }
  }
  ```

- user · tool_result
  ```json
  {
    "type": "user",
    "message": {
      "role": "user",
      "content": [{
        "type": "tool_result",
        "tool_use_id": "toolu_…",
        "content": "…",             // string; may be multi-line
        "is_error": true | false      // optional
      }]
    }
  }
  ```

- user · string (plain text)
  ```json
  {
    "type": "user",
    "isMeta": true | false,          // sometimes present
    "message": { "role": "user", "content": "…" }
  }
  ```

- user · image+text
  ```json
  {
    "type": "user",
    "message": {
      "role": "user",
      "content": [
        { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "…" }},
        { "type": "text", "text": "…" }
      ]
    }
  }
  ```

- summary
  ```json
  { "type": "summary", "summary": "…", "leafUuid": "…" }
  ```

## Template Implications (mobile-friendly)
- assistant · text: standard chat bubble; support code blocks.
- assistant · tool_use: compact “Tool invoked” card with tool name and key inputs; collapsible details.
- user · tool_result: monospace, collapsible output; highlight when `is_error` is true; copy button.
- user · string/text: regular user bubble.
- user · image+text: image thumbnail with caption; tap to expand.
- summary: small summary card; optional “jump to leaf”/anchor if applicable.
- thinking: hide by default; gated behind a developer toggle.

## Coverage Summary
- Events: assistant (59%), user (40%), summary (~1%)
- Content diversity driven by tool interactions (`tool_use`/`tool_result` ≈ 61% combined of all entries)
- Error signaling available via `tool_result.is_error` (17 cases)

This catalog should be sufficient to begin implementing dedicated renderers per entry type and content subtype.
