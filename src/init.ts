import path from "node:path";
import {
  defaultProductConfig,
  writeProjectManifest,
  writeWorkspaceConfig,
} from "./config.js";
import { DEFAULT_PRESET } from "./types.js";

export async function runInit(cwd: string, preset: string): Promise<string[]> {
  if (preset !== DEFAULT_PRESET) {
    throw new Error(`unsupported preset: ${preset} (supported: ${DEFAULT_PRESET})`);
  }

  const written: string[] = [];
  const product = defaultProductConfig(preset);

  const configPath = await writeWorkspaceConfig(cwd, product);
  written.push(path.relative(cwd, configPath) || path.basename(configPath));

  const manifestPath = await writeProjectManifest(cwd, {
    targets: ["web"],
    tooling: ["vite"],
    role: product.role,
    remotes: product.remotes ?? [],
  });
  written.push(path.relative(cwd, manifestPath) || path.basename(manifestPath));

  return written;
}
