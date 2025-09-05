#!/usr/bin/env node

// Lightweight wrapper to serve the prebuilt app via React Router's server
// Usage: npx cc-viz@latest

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, "..");

// Resolve the server build path bundled in the package
const serverBuild = path.join(pkgRoot, "build", "server", "index.js");

if (!fs.existsSync(serverBuild)) {
  console.error(
    "[cc-viz] Missing server build at",
    serverBuild,
    "\nThis package should include prebuilt output. If you see this, please open an issue."
  );
  process.exit(1);
}

// Resolve the react-router-serve CLI entry
const require = createRequire(import.meta.url);
let rrServeBin;
try {
  const servePkgJsonPath = require.resolve("@react-router/serve/package.json", { paths: [pkgRoot] });
  const servePkgDir = path.dirname(servePkgJsonPath);
  const servePkg = JSON.parse(fs.readFileSync(servePkgJsonPath, "utf8"));
  const binField = servePkg.bin;
  const binRel = typeof binField === "string" ? binField : binField?.["react-router-serve"] || Object.values(binField || {})[0];
  if (!binRel) throw new Error("No bin entry in @react-router/serve package.json");
  rrServeBin = path.resolve(servePkgDir, binRel);
} catch (err) {
  console.error("[cc-viz] Failed to resolve @react-router/serve.\n", err);
  process.exit(1);
}

// Spawn the server with cwd at the package root so static `public/` resolves
const child = spawn(process.execPath, [rrServeBin, serverBuild], {
  cwd: pkgRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
