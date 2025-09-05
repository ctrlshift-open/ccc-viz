import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import * as path from "node:path";
import { resolveSessionFile } from "~/utils/path-safety.server";

export type SessionPreview = {
  id: string;
  firstMessage: string;
  totalMessages: number;
  gitBranch?: string;
  timestamp: string;
};

export async function getSessionPreview(project: string, sessionId: string): Promise<SessionPreview | null> {
  const { file } = resolveSessionFile(project, sessionId);
  
  try {
    const content = await readFile(file, "utf8");
    const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
    
    let firstMessage = "";
    let gitBranch: string | undefined;
    let timestamp = "";
    
    // Find first assistant message and git branch info
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      try {
        const parsed = JSON.parse(lines[i]);
        
        // Look for git branch - can be in environment_details or directly in the entry
        if (parsed.gitBranch) {
          gitBranch = parsed.gitBranch;
        } else if (parsed.type === "environment_details" && parsed.environment) {
          const gitMatch = parsed.environment.match(/Current git branch:\s*(.+?)(?:\n|$)/);
          if (gitMatch) {
            gitBranch = gitMatch[1].trim();
          }
        }
        
        // Find first assistant message
        if (!firstMessage && parsed.type === "assistant" && parsed.message) {
          const message = parsed.message;
          const content = message.content;
          
          if (Array.isArray(content)) {
            // Look for text content in the array
            const textContent = content.find(c => c.type === "text");
            if (textContent && textContent.text) {
              // Clean up the text and truncate
              firstMessage = textContent.text
                .replace(/\n+/g, ' ') // Replace newlines with spaces
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim()
                .slice(0, 200); // Truncate to 200 chars
            }
          } else if (typeof content === "string") {
            firstMessage = content
              .replace(/\n+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 200);
          }
        }
        
        // Get timestamp from first entry
        if (!timestamp && parsed.timestamp) {
          timestamp = parsed.timestamp;
        }
        
        // Stop if we found everything
        if (firstMessage && gitBranch && timestamp) break;
      } catch {
        // Skip invalid JSON lines
      }
    }
    
    // If no meaningful first message found, try to find first human message as fallback
    if (!firstMessage) {
      for (let i = 0; i < Math.min(lines.length, 20); i++) {
        try {
          const parsed = JSON.parse(lines[i]);
          if (parsed.type === "user" && parsed.message) {
            const content = parsed.message.content;
            if (Array.isArray(content)) {
              const textContent = content.find(c => typeof c === "string" || c.type === "text");
              if (textContent) {
                const text = typeof textContent === "string" ? textContent : textContent.text;
                if (!text.startsWith("/")) {
                  firstMessage = "User: " + text.slice(0, 150);
                  break;
                }
              }
            } else if (typeof content === "string" && !content.startsWith("/")) {
              firstMessage = "User: " + content.slice(0, 150);
              break;
            }
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
    
    // Final fallback
    if (!firstMessage) {
      firstMessage = "Session started";
    }
    
    return {
      id: sessionId,
      firstMessage,
      totalMessages: lines.length,
      gitBranch,
      timestamp
    };
  } catch (error) {
    console.error(`Failed to get preview for session ${sessionId}:`, error);
    return null;
  }
}

export async function getSessionPreviews(project: string, sessionIds: string[]): Promise<Record<string, SessionPreview | null>> {
  const previews: Record<string, SessionPreview | null> = {};
  
  // Process in parallel but limit concurrency to avoid file system overload
  const BATCH_SIZE = 10;
  for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
    const batch = sessionIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(id => getSessionPreview(project, id))
    );
    batch.forEach((id, index) => {
      previews[id] = batchResults[index];
    });
  }
  
  return previews;
}
