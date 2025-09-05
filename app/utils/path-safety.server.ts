import { homedir } from "node:os";
import * as path from "node:path";

function isSafeSegment(seg: string) {
  if (!seg) return false;
  if (seg === '.' || seg === '..') return false;
  // Disallow any path separators or control chars
  if (/[\\/]/.test(seg)) return false;
  if (/\0/.test(seg)) return false;
  // Limit length to something reasonable
  if (seg.length > 255) return false;
  return true;
}

export function baseProjectsDir() {
  return path.resolve(homedir(), ".claude", "projects");
}

export function assertValidProject(project: string) {
  if (!isSafeSegment(project)) throw new Error("Invalid project parameter");
}

export function assertValidSessionId(sessionId: string) {
  if (!isSafeSegment(sessionId)) throw new Error("Invalid sessionId parameter");
}

export function resolveProjectDir(project: string) {
  assertValidProject(project);
  const base = baseProjectsDir();
  const dir = path.resolve(base, project);
  // Ensure resulting path is inside base dir
  const withSep = base.endsWith(path.sep) ? base : base + path.sep;
  if (!(dir + path.sep).startsWith(withSep)) {
    throw new Error("Project path escapes base directory");
  }
  return { base, dir } as const;
}

export function resolveSessionFile(project: string, sessionId: string) {
  assertValidProject(project);
  assertValidSessionId(sessionId);
  const base = baseProjectsDir();
  const dir = path.resolve(base, project);
  const withSep = base.endsWith(path.sep) ? base : base + path.sep;
  if (!(dir + path.sep).startsWith(withSep)) {
    throw new Error("Project path escapes base directory");
  }
  const file = path.resolve(dir, `${sessionId}.jsonl`);
  const withDirSep = dir.endsWith(path.sep) ? dir : dir + path.sep;
  if (!file.startsWith(withDirSep)) {
    throw new Error("Session file escapes project directory");
  }
  return { base, dir, file } as const;
}
