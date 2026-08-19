import {
  ConfigError,
  loadProjectManifest,
  loadWorkspaceConfig,
  PROJECT_MANIFEST_FILENAME,
  WORKSPACE_CONFIG_FILENAME,
} from "@client-platform/kernel";
import { normalizeProductConfig } from "./config.js";

export type ValidateResult = {
  ok: boolean;
  checks: string[];
  errors: string[];
  warnings: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function runValidate(cwd: string): Promise<ValidateResult> {
  const checks: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const workspace = await loadWorkspaceConfig(cwd);
    checks.push(
      `loaded ${WORKSPACE_CONFIG_FILENAME} (schemaVersion=${workspace.schemaVersion})`,
    );

    const manifest = await loadProjectManifest(cwd);
    checks.push(
      `loaded ${PROJECT_MANIFEST_FILENAME} (schemaVersion=${manifest.schemaVersion})`,
    );

    if (!isRecord(workspace.products?.microfrontend)) {
      errors.push("products.microfrontend missing in workspace config");
      return { ok: false, checks, errors, warnings };
    }

    const product = normalizeProductConfig(workspace.products.microfrontend);
    if (!product) {
      errors.push(
        "products.microfrontend must include preset, host.name, and host.entry",
      );
      return { ok: false, checks, errors, warnings };
    }

    checks.push(`preset=${product.preset}`);
    checks.push(`adapter=${product.adapter}`);
    checks.push(`host=${product.host.name} (${product.host.entry})`);

    const names = new Set<string>();
    const entries = new Set<string>();
    for (const remote of product.remotes) {
      if (names.has(remote.name)) {
        errors.push(`duplicate remote name: ${remote.name}`);
      }
      names.add(remote.name);
      if (entries.has(remote.entry)) {
        errors.push(`duplicate remote entry: ${remote.entry}`);
      }
      entries.add(remote.entry);
    }
    checks.push(`remotes=${product.remotes.length}`);

    if (isRecord(manifest) && ("role" in manifest || "remotes" in manifest)) {
      warnings.push(
        "project manifest should not duplicate host/remote composition; keep remotes under products.microfrontend",
      );
    }
  } catch (err) {
    const message =
      err instanceof ConfigError || err instanceof Error ? err.message : String(err);
    errors.push(message);
  }

  return { ok: errors.length === 0, checks, errors, warnings };
}
