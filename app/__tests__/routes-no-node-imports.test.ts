import { readdirSync, readFileSync, statSync } from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

describe("route modules avoid Node built-ins at top-level (tsx)", () => {
  const routesDir = path.join(process.cwd(), "app", "routes");
  const files = walk(routesDir).filter((f) => /\.tsx$/.test(f));

  it("no top-level node: protocol imports in .tsx routes", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/^import\s+[^;]+from\s+["']node:[^"']+["']/m.test(text)) offenders.push(file);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("no top-level bare fs/path/os imports in .tsx routes", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/^import\s+[^;]+from\s+["'](?:fs(?:\/promises)?|path|os)["']/m.test(text)) offenders.push(file);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

