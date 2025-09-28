import { spawn } from "node:child_process";
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

      resolve({
        success,
        output: stdout,
        error: stderr || undefined,
        exitCode,
      });
    });

    const timeout = setTimeout(() => {
      child.kill();
      resolve({
        success: false,
        output: stdout,
        error: "Command timed out after 5 minutes",
        exitCode: 124,
      });
    }, 5 * 60 * 1000);

    child.on("close", () => {
      clearTimeout(timeout);
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

    const timeout = setTimeout(() => {
      child.kill();
      resolve({
        success: false,
        error: "Command timed out after 2 minutes",
        exitCode: 124,
      });
    }, 2 * 60 * 1000);

    child.on("close", () => {
      clearTimeout(timeout);
    });
  });
}