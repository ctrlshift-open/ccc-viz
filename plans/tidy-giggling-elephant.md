# Card Title Generation Fix

## Problem

The AI title generation fails because the Claude CLI output contains newlines and verbose explanations instead of a simple title.

**Root Cause**: The validation in `generateAITitle()` (kanban.server.ts:157) checks:
```typescript
if (title && title.length > 0 && title.length < 100 && !title.includes("\n")) {
  return title;
}
return null;
```

When the CLI returns multi-line output (options, explanations, questions), validation fails and returns `null`, causing fallback to branch name / session ID.

**Evidence**: Testing the CLI command shows verbose responses with newlines:
```
I need to understand what you're asking...
1. A title for a bean/issue...
2. A title for a plan document...
```

## Solution

Use `--system-prompt` to override the default system prompt with a minimal, non-interactive directive.

## Changes

**File: `app/utils/kanban.server.ts`**

Lines 146-172, update `generateAITitle()`:

```typescript
export async function generateAITitle(contentFilePath: string): Promise<string | null> {
  const systemPrompt = "Output only the requested text. No explanations, questions, or formatting.";
  const prompt = "Generate a concise 3-7 word title for this conversation. Output ONLY the title.";

  try {
    const { stdout } = await execAsync(
      `claude --model haiku --print --system-prompt "${systemPrompt}" "${prompt}" < "${contentFilePath}"`,
      { timeout: 30000 }
    );

    const title = stdout.trim();
    if (title && title.length > 0 && title.length < 100 && !title.includes("\n")) {
      return title;
    }
    return null;
  } catch (error) {
    console.error("AI title generation failed:", error);
    return null;
  } finally {
    try {
      await fs.unlink(contentFilePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
```

## Verification

1. Start dev server: `pnpm dev`
2. Open http://localhost:5174/kanban
3. Click the star/regenerate button on a card
4. Confirm title changes to something concise (3-7 words)
5. Test CLI manually:
   ```bash
   echo "test content" | claude --model haiku --print --system-prompt "Output only the requested text. No explanations." "Generate a 3-7 word title"
   ```
