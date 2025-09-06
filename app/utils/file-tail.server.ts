import { watch as fsWatch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { open as fsOpen, stat as fsStat } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { resolveSessionFile } from "~/utils/path-safety.server";

type ParsedLine =
  | { ok: true; value: unknown; line: number }
  | { ok: false; value: string; line: number };

type Subscriber = (batch: ParsedLine[]) => void;

type TailKey = string; // `${project}:${sessionId}`

const TAILER_IDLE_TTL_MS = 60_000; // 60s after last subscriber disconnects

class FileTailer {
  private filePath: string;
  private fh: FileHandle | null = null;
  private offset = 0; // byte offset
  private lineCount = 0; // number of completed lines seen
  private leftover = ""; // partial line without trailing newline
  private subs: Set<Subscriber> = new Set();
  private watcher: FSWatcher | null = null;
  private reading = false;
  private disposed = false;
  private disposeTimer: ReturnType<typeof setTimeout> | null = null;
  private onDispose: (() => void) | null = null;
  private lastAppendAt: number | null = null;

  // Optional cost calculators (lazy)
  private costReady = false;
  private calculateCostForEntry: ((v: any, _mode: "auto", fetcher: any) => Promise<number | undefined>) | null = null;
  private pricingFetcher: any = null;

  constructor(filePath: string, onDispose?: () => void) {
    this.filePath = filePath;
    this.onDispose = onDispose ?? null;
  }

  async init(fromLineHint?: number) {
    if (this.disposed) return;
    try {
      const st = await fsStat(this.filePath);
      // Start tailing from current end
      this.offset = st.size;
      // Prefer hint from client to avoid counting whole file
      this.lineCount = Math.max(0, Math.floor(fromLineHint ?? 0));
    } catch {
      // If stat fails, start from offset 0, lineCount 0
      this.offset = 0;
      this.lineCount = Math.max(0, Math.floor(fromLineHint ?? 0));
    }
    // Create watcher after init
    this.startWatcher();
  }

  private startWatcher() {
    if (this.watcher || this.disposed) return;
    try {
      this.watcher = fsWatch(this.filePath, { persistent: false }, (eventType) => {
        if (this.disposed) return;
        if (eventType === "rename") {
          // Reopen on rotation/rename
          this.reopen();
        } else {
          this.readNew();
        }
      });
    } catch {
      // If fs.watch fails (e.g., file doesn't exist yet), fall back to periodic polling
      const interval = setInterval(() => {
        if (this.disposed) { clearInterval(interval); return; }
        this.readNew();
      }, 1000);
    }
  }

  private async reopen() {
    try {
      if (this.fh) { await this.fh.close().catch(() => {}); this.fh = null; }
      const st = await fsStat(this.filePath);
      this.offset = Math.min(this.offset, st.size);
      // Keep lineCount as-is; if file truncated, we may undercount but keys remain unique
    } catch {
      // File may not exist yet
      this.offset = 0;
    }
  }

  private async ensureOpen() {
    if (this.fh) return;
    try {
      this.fh = await fsOpen(this.filePath, "r");
    } catch {
      this.fh = null;
    }
  }

  private async ensureCost() {
    if (this.costReady) return;
    try {
      const [{ PricingFetcher }, { calculateCostForEntry }] = await Promise.all([
        import("ccusage/pricing-fetcher"),
        import("ccusage/data-loader"),
      ]);
      this.pricingFetcher = new PricingFetcher(true);
      this.calculateCostForEntry = calculateCostForEntry;
      this.costReady = true;
    } catch {
      this.costReady = true; // avoid retry storms; stay without costs
    }
  }

  private async readNew() {
    if (this.reading || this.disposed) return;
    this.reading = true;
    try {
      const st = await fsStat(this.filePath).catch(() => null);
      if (!st) return;
      if (st.size < this.offset) {
        // File truncated; reset
        this.offset = 0;
        this.leftover = "";
      }
      const toRead = st.size - this.offset;
      if (toRead <= 0) return;

      await this.ensureOpen();
      if (!this.fh) return;

      const buf = Buffer.allocUnsafe(Math.min(toRead, 1024 * 1024 * 8)); // up to 8MB per read
      let remaining = toRead;
      let chunks: string[] = [];
      let position = this.offset;
      while (remaining > 0) {
        const len = Math.min(remaining, buf.length);
        const { bytesRead } = await this.fh.read(buf, 0, len, position);
        if (bytesRead <= 0) break;
        chunks.push(buf.subarray(0, bytesRead).toString("utf8"));
        remaining -= bytesRead;
        position += bytesRead;
      }
      this.offset = position;
      if (chunks.length === 0) return;
      let text = this.leftover + chunks.join("");
      let lines = text.split(/\r?\n/);
      // If the text ends with newline, last is empty; otherwise it's partial leftover
      this.leftover = lines[lines.length - 1].length > 0 ? lines.pop() || "" : "";

      if (lines.length > 0) {
        const batch: ParsedLine[] = [];
        // Best effort: add costs if library available
        await this.ensureCost();
        for (const l of lines) {
          if (!l) continue;
          try {
            const v = JSON.parse(l);
            // Attach per-entry cost for consistency with detail view
            if (this.calculateCostForEntry && this.pricingFetcher) {
              try {
                const cost = await this.calculateCostForEntry(v, "auto", this.pricingFetcher);
                if (typeof cost === "number" && Number.isFinite(cost) && typeof v === "object" && v) {
                  (v as any).costUSD = cost;
                }
              } catch {}
            }
            batch.push({ ok: true, value: v, line: this.lineCount });
            this.lineCount += 1;
          } catch {
            batch.push({ ok: false, value: l, line: this.lineCount });
            this.lineCount += 1;
          }
        }
        if (batch.length > 0) {
          this.lastAppendAt = Date.now();
          this.broadcast(batch);
        }
      }
    } finally {
      this.reading = false;
    }
  }

  private broadcast(batch: ParsedLine[]) {
    for (const sub of this.subs) {
      try { sub(batch); } catch { /* ignore subscriber errors */ }
    }
  }

  subscribe(fn: Subscriber): () => void {
    // Clear any pending disposal since we now have a subscriber
    if (this.disposeTimer) { try { clearTimeout(this.disposeTimer); } catch {} this.disposeTimer = null; }
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
      if (this.subs.size === 0 && !this.disposed) {
        // Schedule disposal after TTL if still unused
        if (!this.disposeTimer) {
          this.disposeTimer = setTimeout(async () => {
            this.disposeTimer = null;
            if (this.subs.size === 0 && !this.disposed) {
              await this.dispose();
              try { this.onDispose?.(); } catch {}
            }
          }, TAILER_IDLE_TTL_MS);
        }
      }
    };
  }

  async dispose() {
    this.disposed = true;
    try { if (this.fh) await this.fh.close(); } catch {}
    this.fh = null;
    if (this.watcher) {
      try { this.watcher.close(); } catch {}
      this.watcher = null;
    }
    if (this.disposeTimer) { try { clearTimeout(this.disposeTimer); } catch {} this.disposeTimer = null; }
  }

  getLastAppendAt(): number | null { return this.lastAppendAt; }
  getSubscriberCount(): number { return this.subs.size; }
}

const REGISTRY = new Map<TailKey, FileTailer>();

function keyFor(project: string, sessionId: string): TailKey {
  return `${project}:${sessionId}`;
}

export async function getOrCreateTailer(project: string, sessionId: string, fromLineHint?: number) {
  const { file } = resolveSessionFile(project, sessionId);
  const key = keyFor(project, sessionId);
  let t = REGISTRY.get(key);
  if (!t) {
    t = new FileTailer(file, () => {
      REGISTRY.delete(key);
    });
    REGISTRY.set(key, t);
    await t.init(fromLineHint);
  }
  return t;
}

export async function disposeTailer(project: string, sessionId: string) {
  const key = keyFor(project, sessionId);
  const t = REGISTRY.get(key);
  if (t) {
    await t.dispose();
    REGISTRY.delete(key);
  }
}

export function getExistingTailer(project: string, sessionId: string): FileTailer | null {
  const key = keyFor(project, sessionId);
  return REGISTRY.get(key) ?? null;
}
