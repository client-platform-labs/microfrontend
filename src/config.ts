import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./fs-utils.js";
import { parseJsonc, stringifyJsonc } from "./jsonc.js";
import {
  CONFIG_FILE_NAME,
  DEFAULT_ADAPTER,
  DEFAULT_HOST,
  DEFAULT_PRESET,
  MANIFEST_FILE_NAME,
  SCHEMA_VERSION,
  type MicrofrontendConfig,
  type MicrofrontendRemote,
  type ProjectManifestFile,
  type WorkspaceConfigFile,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function loadJsoncFile(filePath: string): Promise<unknown> {
  const text = await readFile(filePath, "utf8");
  try {
    return parseJsonc(text);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`invalid JSONC: ${filePath} (${reason})`);
  }
}

export function parseWorkspaceConfig(value: unknown): WorkspaceConfigFile {
  if (!isRecord(value) || typeof value.schemaVersion !== "string") {
    throw new Error(`${CONFIG_FILE_NAME} must include string schemaVersion`);
  }
  return value as WorkspaceConfigFile;
}

export function parseProjectManifest(value: unknown): ProjectManifestFile {
  if (!isRecord(value) || typeof value.schemaVersion !== "string") {
    throw new Error(`${MANIFEST_FILE_NAME} must include string schemaVersion`);
  }
  return value as ProjectManifestFile;
}

async function writeJsoncFile(
  filePath: string,
  value: unknown,
  header: string,
): Promise<void> {
  await writeFile(filePath, stringifyJsonc(value, header), "utf8");
}

export function defaultProductConfig(preset: string): MicrofrontendConfig {
  return {
    preset: preset || DEFAULT_PRESET,
    adapter: DEFAULT_ADAPTER,
    host: { ...DEFAULT_HOST },
    remotes: [],
  };
}

export function normalizeProductConfig(
  value: unknown,
): MicrofrontendConfig | null {
  if (!isRecord(value)) return null;
  if (typeof value.preset !== "string" || !value.preset) return null;
  if (!isRecord(value.host)) return null;
  if (typeof value.host.name !== "string" || !value.host.name) return null;
  if (typeof value.host.entry !== "string" || !value.host.entry) return null;

  const remotesRaw = Array.isArray(value.remotes) ? value.remotes : [];
  const remotes: MicrofrontendRemote[] = [];
  for (const remote of remotesRaw) {
    if (!isRecord(remote)) continue;
    if (typeof remote.name !== "string" || !remote.name) continue;
    if (typeof remote.entry !== "string" || !remote.entry) continue;
    remotes.push({ name: remote.name, entry: remote.entry });
  }

  return {
    preset: value.preset,
    adapter:
      value.adapter === "vite-federation" ? "vite-federation" : DEFAULT_ADAPTER,
    host: {
      name: value.host.name,
      entry: value.host.entry,
    },
    remotes,
  };
}

export async function writeWorkspaceConfig(
  cwd: string,
  patch: MicrofrontendConfig,
): Promise<string> {
  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  const existing = (await pathExists(configPath))
    ? parseWorkspaceConfig(await loadJsoncFile(configPath))
    : { schemaVersion: SCHEMA_VERSION };
  const next: WorkspaceConfigFile = {
    ...existing,
    schemaVersion: existing.schemaVersion || SCHEMA_VERSION,
    products: {
      ...existing.products,
      microfrontend: {
        preset: patch.preset,
        adapter: patch.adapter,
        host: patch.host,
        remotes: patch.remotes,
      },
    },
  };
  await writeJsoncFile(
    configPath,
    next,
    "// Client Platform workspace config",
  );
  return configPath;
}

export async function writeProjectManifest(
  cwd: string,
  patch: Pick<ProjectManifestFile, "targets" | "tooling">,
): Promise<string> {
  const manifestPath = path.join(cwd, MANIFEST_FILE_NAME);
  const existing = (await pathExists(manifestPath))
    ? parseProjectManifest(await loadJsoncFile(manifestPath))
    : { schemaVersion: SCHEMA_VERSION };
  const next: ProjectManifestFile = {
    schemaVersion: existing.schemaVersion || SCHEMA_VERSION,
    targets: patch.targets ?? existing.targets,
    tooling: patch.tooling ?? existing.tooling,
  };
  await writeJsoncFile(
    manifestPath,
    next,
    "// Client Platform project manifest",
  );
  return manifestPath;
}

export type LoadedProject = {
  cwd: string;
  configPath: string;
  manifestPath: string;
  workspace: WorkspaceConfigFile;
  project: ProjectManifestFile;
  product: MicrofrontendConfig | null;
};

export async function loadProject(cwd: string): Promise<LoadedProject> {
  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  const manifestPath = path.join(cwd, MANIFEST_FILE_NAME);
  if (!(await pathExists(configPath))) {
    throw new Error(`missing ${CONFIG_FILE_NAME}; run \`microfrontend init\``);
  }
  if (!(await pathExists(manifestPath))) {
    throw new Error(`missing ${MANIFEST_FILE_NAME}; run \`microfrontend init\``);
  }
  const workspace = parseWorkspaceConfig(await loadJsoncFile(configPath));
  return {
    cwd,
    configPath,
    manifestPath,
    workspace,
    project: parseProjectManifest(await loadJsoncFile(manifestPath)),
    product: normalizeProductConfig(workspace.products?.microfrontend),
  };
}
