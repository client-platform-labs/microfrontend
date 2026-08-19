import path from "node:path";
import {
  defaultProductConfig,
  loadProject,
  writeWorkspaceConfig,
} from "./config.js";
import type { MicrofrontendRemote } from "./types.js";

export type AddRemoteResult = {
  remote: MicrofrontendRemote;
  remotes: MicrofrontendRemote[];
  configPath: string;
};

export async function runAddRemote(
  cwd: string,
  name: string,
  entry?: string,
): Promise<AddRemoteResult> {
  if (!name || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error(
      `invalid remote name "${name}" (expected identifier like remote_app)`,
    );
  }

  const project = await loadProject(cwd);
  const product = project.product ?? defaultProductConfig("host-react-vite");
  if (product.remotes.some((r) => r.name === name)) {
    throw new Error(`remote already registered: ${name}`);
  }

  const remote: MicrofrontendRemote = {
    name,
    entry:
      entry ??
      `http://localhost:${5000 + product.remotes.length + 1}/assets/remoteEntry.js`,
  };

  const next = {
    ...product,
    remotes: [...product.remotes, remote],
  };
  const configPath = await writeWorkspaceConfig(cwd, next);
  return {
    remote,
    remotes: next.remotes,
    configPath: path.relative(cwd, configPath) || path.basename(configPath),
  };
}
