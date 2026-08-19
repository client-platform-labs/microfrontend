import {
  ConfigError,
  loadProjectManifest,
  loadWorkspaceConfig,
  PROJECT_MANIFEST_FILENAME,
  WORKSPACE_CONFIG_FILENAME,
} from "@client-platform/kernel";

export type ValidateResult = {
  ok: boolean;
  checks: string[];
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function runValidate(cwd: string): Promise<ValidateResult> {
  const checks: string[] = [];
  const errors: string[] = [];

  try {
    const workspace = await loadWorkspaceConfig(cwd);
    checks.push(
      `loaded ${WORKSPACE_CONFIG_FILENAME} (schemaVersion=${workspace.schemaVersion})`,
    );

    const manifest = await loadProjectManifest(cwd);
    checks.push(
      `loaded ${PROJECT_MANIFEST_FILENAME} (schemaVersion=${manifest.schemaVersion})`,
    );

    const product = workspace.products?.microfrontend;
    if (!isRecord(product)) {
      errors.push("products.microfrontend missing in workspace config");
    } else {
      checks.push("products.microfrontend present");
      if (typeof product.preset !== "string" || !product.preset) {
        errors.push("products.microfrontend.preset must be a non-empty string");
      } else {
        checks.push(`preset=${product.preset}`);
      }
    }
  } catch (err) {
    const message =
      err instanceof ConfigError || err instanceof Error ? err.message : String(err);
    errors.push(message);
  }

  return { ok: errors.length === 0, checks, errors };
}
