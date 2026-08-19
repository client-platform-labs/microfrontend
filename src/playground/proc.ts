import { spawn, type ChildProcess } from "node:child_process";

const DEFAULT_PREVIEW_TIMEOUT_MS = 60_000;
const SIGKILL_GRACE_MS = 2_000;

export type ProcessGroup = {
  track(child: ChildProcess): void;
  killAll(): Promise<void>;
};

function spawnChild(
  cmd: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): ChildProcess {
  return spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
}

function pipePrefixedLines(
  child: ChildProcess,
  prefix: string,
  onChunk?: (text: string) => void,
): void {
  const attach = (stream: NodeJS.ReadableStream | null): void => {
    if (!stream) {
      return;
    }
    let leftover = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      onChunk?.(chunk);
      leftover += chunk;
      const lines = leftover.split(/\r?\n/);
      leftover = lines.pop() ?? "";
      for (const line of lines) {
        console.log(`[${prefix}] ${line}`);
      }
    });
    stream.on("end", () => {
      if (leftover.length > 0) {
        console.log(`[${prefix}] ${leftover}`);
      }
    });
  };
  attach(child.stdout);
  attach(child.stderr);
}

function commandLabel(cmd: string, args: string[]): string {
  return [cmd, ...args].join(" ");
}

function failReason(code: number | null, signal: NodeJS.Signals | null): string {
  return code == null ? `signal ${signal}` : `exit code ${code}`;
}

function matchesReady(buffer: string, readyRegex: RegExp): boolean {
  if (readyRegex.global || readyRegex.sticky) {
    readyRegex.lastIndex = 0;
  }
  return readyRegex.test(buffer);
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode != null || child.signalCode != null;
}

function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    const onExit = (): void => resolve();
    child.once("exit", onExit);
    if (hasExited(child)) {
      child.off("exit", onExit);
      resolve();
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function tryKill(child: ChildProcess, signal: NodeJS.Signals): void {
  if (hasExited(child) || child.pid == null) {
    return;
  }
  try {
    child.kill(signal);
  } catch {
    // Process already gone (ESRCH) or unkillable.
  }
}

export function runCommand(opts: {
  cwd: string;
  cmd: string;
  args: string[];
  prefix: string;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnChild(opts.cmd, opts.args, opts.cwd, opts.env);
    pipePrefixedLines(child, opts.prefix);
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${commandLabel(opts.cmd, opts.args)} failed: ${failReason(code, signal)}`,
        ),
      );
    });
  });
}

export function spawnPreview(opts: {
  cwd: string;
  cmd: string;
  args: string[];
  prefix: string;
  readyRegex: RegExp;
  timeoutMs?: number;
}): Promise<ChildProcess> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_PREVIEW_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const child = spawnChild(opts.cmd, opts.args, opts.cwd);
    let settled = false;
    let buffer = "";

    const finish = (action: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      action();
    };

    const timer = setTimeout(() => {
      finish(() => {
        void killProcessTree(child).finally(() => {
          reject(
            new Error(
              `timed out after ${timeoutMs}ms waiting for ${opts.prefix} to become ready`,
            ),
          );
        });
      });
    }, timeoutMs);

    pipePrefixedLines(child, opts.prefix, (chunk) => {
      buffer += chunk;
      if (!settled && matchesReady(buffer, opts.readyRegex)) {
        finish(() => resolve(child));
      }
    });

    child.once("error", (err) => {
      finish(() => reject(err));
    });
    child.once("close", (code, signal) => {
      finish(() => {
        reject(
          new Error(
            `${commandLabel(opts.cmd, opts.args)} exited before ready (${failReason(code, signal)})`,
          ),
        );
      });
    });
  });
}

export async function killProcessTree(child: ChildProcess): Promise<void> {
  if (hasExited(child) || child.pid == null) {
    return;
  }

  child.once("error", () => {
    // Ignore ESRCH from kill after the process has already exited.
  });

  const exited = waitForExit(child);
  tryKill(child, "SIGTERM");

  const timedOut = await Promise.race([
    exited.then(() => false),
    sleep(SIGKILL_GRACE_MS).then(() => true),
  ]);

  if (timedOut && !hasExited(child)) {
    tryKill(child, "SIGKILL");
    await exited;
  }
}

export function createProcessGroup(): ProcessGroup {
  const children: ChildProcess[] = [];
  return {
    track(child) {
      children.push(child);
    },
    async killAll() {
      const pending = children.splice(0);
      await Promise.all(pending.map((child) => killProcessTree(child)));
    },
  };
}
