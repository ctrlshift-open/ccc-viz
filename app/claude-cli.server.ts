import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";

export type CLIResult = {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
};

export type NewSessionResult = {
  success: boolean;
  sessionId?: string;
  error?: string;
  exitCode: number;
};

export type SendPromptOptions = {
  model?: string;
  printMode?: boolean;
  workingDirectory?: string;
};

// Process registry to track active Claude CLI processes
const activeProcesses = new Map<string, {
  process: ChildProcess;
  startTime: number;
  command: string;
}>();

export function getActiveProcess(sessionId: string): ChildProcess | undefined {
  return activeProcesses.get(sessionId)?.process;
}

export function isProcessActive(sessionId: string): boolean {
  const entry = activeProcesses.get(sessionId);
  return entry !== undefined && !entry.process.killed;
}

export function cancelProcess(sessionId: string): boolean {
  const entry = activeProcesses.get(sessionId);
  if (!entry || entry.process.killed) {
    return false;
  }

  console.log(`[cancelProcess] Sending SIGINT to session ${sessionId}`);
  entry.process.kill('SIGINT');

  // Safety: SIGKILL after 10s if still running
  setTimeout(() => {
    if (!entry.process.killed) {
      console.warn(`[cancelProcess] SIGINT failed for ${sessionId}, sending SIGKILL`);
      entry.process.kill('SIGKILL');
    }
  }, 10000);

  return true;
}

function validateSessionId(sessionId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(sessionId);
}

export async function sendPromptToSession(
  sessionId: string,
  prompt: string,
  options: SendPromptOptions = {}
): Promise<CLIResult> {
  if (!validateSessionId(sessionId)) {
    return {
      success: false,
      output: "",
      error: "Invalid session ID format",
      exitCode: 1,
    };
  }

  if (!prompt || prompt.trim().length === 0) {
    return {
      success: false,
      output: "",
      error: "Prompt cannot be empty",
      exitCode: 1,
    };
  }

  const args: string[] = ["--resume", sessionId];

  if (options.printMode !== false) {
    args.push("--print");
  }

  if (options.model) {
    args.push("--model", options.model);
  }

  args.push("--permission-mode", "bypassPermissions");

  args.push(prompt);

  console.log("[claude-cli] Executing:", "claude", args.slice(0, -1).join(" "), `"${prompt.slice(0, 50)}..."`);

  return new Promise((resolve) => {
    const child = spawn("claude", args, {
      cwd: options.workingDirectory,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Register process in active registry
    activeProcesses.set(sessionId, {
      process: child,
      startTime: Date.now(),
      command: prompt.slice(0, 100)
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      console.error("[claude-cli] Process error:", error.message);
      activeProcesses.delete(sessionId);
      resolve({
        success: false,
        output: stdout,
        error: `Failed to execute CLI: ${error.message}`,
        exitCode: 1,
      });
    });

    child.on("close", (code) => {
      const exitCode = code ?? 1;
      const success = exitCode === 0;

      console.log("[claude-cli] Process closed with code:", exitCode);
      if (stderr) console.error("[claude-cli] stderr:", stderr);

      activeProcesses.delete(sessionId);

      resolve({
        success,
        output: stdout,
        error: stderr || undefined,
        exitCode,
      });
    });
  });
}

export async function startNewSession(
  workingDirectory: string,
  initialPrompt?: string,
  options: { model?: string } = {}
): Promise<NewSessionResult> {
  const sessionId = randomUUID();
  const prompt = initialPrompt || "Hello! I'm ready to help.";

  const args: string[] = [
    "--session-id",
    sessionId,
    "--print",
    "--permission-mode",
    "bypassPermissions",
  ];

  if (options.model) {
    args.push("--model", options.model);
  }

  args.push(prompt);

  console.log("[startNewSession] Creating session:", sessionId);
  console.log("[startNewSession] Working directory:", workingDirectory);
  console.log("[startNewSession] Prompt:", prompt.slice(0, 100));

  return new Promise((resolve) => {
    const child = spawn("claude", args, {
      cwd: workingDirectory,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Register process in active registry
    activeProcesses.set(sessionId, {
      process: child,
      startTime: Date.now(),
      command: prompt.slice(0, 100)
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      console.error("[startNewSession] Process error:", error.message);
      activeProcesses.delete(sessionId);
      resolve({
        success: false,
        error: `Failed to execute CLI: ${error.message}`,
        exitCode: 1,
      });
    });

    child.on("close", (code) => {
      const exitCode = code ?? 1;
      const success = exitCode === 0;

      console.log("[startNewSession] Process closed with code:", exitCode);
      if (stderr) console.error("[startNewSession] stderr:", stderr);

      activeProcesses.delete(sessionId);

      if (success) {
        resolve({
          success: true,
          sessionId,
          exitCode: 0,
        });
      } else {
        resolve({
          success: false,
          error: stderr || "Failed to create session",
          exitCode,
        });
      }
    });
  });
}