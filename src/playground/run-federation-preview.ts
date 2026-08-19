import { type ChildProcess } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadProject } from "../config.js";
import { pathExists } from "../fs-utils.js";
import type { PreviewOptions } from "../preview-static.js";
import { runValidate } from "../validate.js";
import { hostDir, playgroundRoot, remoteDir } from "./paths.js";
import {
  createProcessGroup,
  runCommand,
  spawnPreview,
  type ProcessGroup,
} from "./proc.js";
import { resolveRemoteNames, scaffoldPlayground } from "./scaffold.js";

const DEFAULT_HOST_PORT = 4173;
const VITE_READY = /Local:\s+https?:\/\/(?:127\.0\.0\.1|localhost)/;
const PORT_IN_USE = /EADDRINUSE|already in use|Port \d+ is already in use|strictPort/i;

export type FederationPreviewResult = {
  hostUrl?: string;
  statusPath: string;
  remotes: Array<{ name: string; port: number }>;
};

type ViteInvocation = {
  cmd: string;
  viteArgs: string[];
};

export async function runFederationPreview(
  cwd: string,
  options: PreviewOptions = {},
): Promise<FederationPreviewResult> {
  const validation = await runValidate(cwd);
  if (!validation.ok) {
    throw new Error(
      `validate failed:\n${validation.errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  const project = await loadProject(cwd);
  if (!project.product) {
    throw new Error("products.microfrontend missing or invalid");
  }

  if ((project.product.adapter as string) !== "vite-federation") {
    throw new Error(
      "adapter must be vite-federation for real preview; use --static",
    );
  }

  const hostPort = options.port ?? DEFAULT_HOST_PORT;
  const remoteNames = resolveRemoteNames(project.product.remotes);
  const root = playgroundRoot(cwd);

  if (options.clean) {
    await rm(root, { recursive: true, force: true });
  }

  const scaffolded = await scaffoldPlayground(cwd, {
    hostName: project.product.host.name,
    remoteNames,
    hostPort,
  });

  const nodeModules = path.join(root, "node_modules");
  if (options.clean || !(await pathExists(nodeModules))) {
    await runCommand({
      cwd: root,
      cmd: "npm",
      args: ["install"],
      prefix: "playground",
    });
  }

  const vite = await resolveLocalVite([
    root,
    hostDir(cwd),
    ...scaffolded.remotes.map((remote) => remoteDir(cwd, remote.name)),
  ]);

  for (const remote of scaffolded.remotes) {
    const remotePath = remoteDir(cwd, remote.name);
    try {
      await runVite(vite, remotePath, ["build"], `remote:${remote.name}`);
    } catch (err) {
      throw new Error(
        `remote ${remote.name} build failed: ${errorMessage(err)}`,
      );
    }
  }

  try {
    await runVite(vite, hostDir(cwd), ["build"], "host");
  } catch (err) {
    throw new Error(`host build failed: ${errorMessage(err)}`);
  }

  const hostUrl = `http://127.0.0.1:${hostPort}/`;
  const statusPath = path.join(root, "playground-status.json");
  await writeFile(
    statusPath,
    `${JSON.stringify(
      {
        ok: true,
        hostPort,
        hostUrl,
        remotes: scaffolded.remotes.map((remote) => ({
          name: remote.name,
          port: remote.port,
          entry: `http://127.0.0.1:${remote.port}/assets/remoteEntry.js`,
        })),
        adapter: "vite-federation",
        vite: "7",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const result: FederationPreviewResult = {
    hostUrl,
    statusPath,
    remotes: scaffolded.remotes.map((remote) => ({
      name: remote.name,
      port: remote.port,
    })),
  };

  if (options.writeOnly) {
    return result;
  }

  const group = createProcessGroup();
  const live: Array<{ prefix: string; child: ChildProcess }> = [];
  try {
    for (const remote of scaffolded.remotes) {
      const prefix = `remote:${remote.name}`;
      const child = await spawnVitePreview(
        vite,
        remoteDir(cwd, remote.name),
        remote.port,
        prefix,
      );
      group.track(child);
      live.push({ prefix, child });
    }

    const hostChild = await spawnVitePreview(
      vite,
      hostDir(cwd),
      hostPort,
      "host",
    );
    group.track(hostChild);
    live.push({ prefix: "host", child: hostChild });
  } catch (err) {
    await group.killAll();
    throw err;
  }

  console.log(`[microfrontend] federation preview ${hostUrl}`);
  await waitUntilStopped(group, live);
  return result;
}

async function resolveLocalVite(dirs: string[]): Promise<ViteInvocation> {
  for (const dir of dirs) {
    const viteJs = path.join(dir, "node_modules", "vite", "bin", "vite.js");
    if (await pathExists(viteJs)) {
      return { cmd: process.execPath, viteArgs: [viteJs] };
    }
  }

  const shim = process.platform === "win32" ? "vite.cmd" : "vite";
  for (const dir of dirs) {
    const bin = path.join(dir, "node_modules", ".bin", shim);
    if (await pathExists(bin)) {
      return { cmd: bin, viteArgs: [] };
    }
  }

  throw new Error(
    `vite binary not found in playground node_modules (looked for vite/bin/vite.js and .bin/${shim}); run with clean or npm install in the playground`,
  );
}

function runVite(
  vite: ViteInvocation,
  cwd: string,
  args: string[],
  prefix: string,
): Promise<void> {
  return runCommand({
    cwd,
    cmd: vite.cmd,
    args: [...vite.viteArgs, ...args],
    prefix,
  });
}

async function spawnVitePreview(
  vite: ViteInvocation,
  cwd: string,
  port: number,
  prefix: string,
): Promise<ChildProcess> {
  try {
    return await spawnPreview({
      cwd,
      cmd: vite.cmd,
      args: [
        ...vite.viteArgs,
        "preview",
        "--port",
        String(port),
        "--strictPort",
      ],
      prefix,
      readyRegex: VITE_READY,
    });
  } catch (err) {
    throw portConflictError(prefix, port, err);
  }
}

async function waitUntilStopped(
  group: ProcessGroup,
  live: Array<{ prefix: string; child: ChildProcess }>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let stopping = false;

    const finish = (action: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      action();
    };

    const tearDown = (next: () => void): void => {
      stopping = true;
      void group.killAll().finally(next);
    };

    const onSignal = (): void => {
      tearDown(() => finish(resolve));
    };

    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);

    for (const { prefix, child } of live) {
      child.once("exit", (code, signal) => {
        if (stopping || settled) {
          return;
        }
        const reason =
          code == null ? `signal ${signal}` : `exit code ${code}`;
        tearDown(() =>
          finish(() =>
            reject(
              new Error(`${prefix} preview exited unexpectedly (${reason})`),
            ),
          ),
        );
      });
    }
  });
}

function portConflictError(label: string, port: number, err: unknown): Error {
  const message = errorMessage(err);
  const code = errorCode(err);
  if (code === "EADDRINUSE" || PORT_IN_USE.test(message)) {
    return new Error(
      `${label}: port ${port} is already in use (vite --strictPort). Stop the other process and retry.`,
    );
  }
  return new Error(`${label}: preview failed on port ${port}: ${message}`);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function errorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}
