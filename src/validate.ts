import { loadProject } from "./config.js";

export type ValidateResult = {
  ok: boolean;
  checks: string[];
  errors: string[];
};

export async function runValidate(cwd: string): Promise<ValidateResult> {
  const checks: string[] = [];
  const errors: string[] = [];

  try {
    const loaded = await loadProject(cwd);
    checks.push(`loaded ${loaded.configPath}`);
    checks.push(`loaded ${loaded.manifestPath}`);

    const product = loaded.workspace.products?.microfrontend;
    if (!product || typeof product !== "object") {
      errors.push("products.microfrontend missing in workspace config");
    } else {
      checks.push("products.microfrontend present");
      if (typeof product.preset !== "string" || !product.preset) {
        errors.push("products.microfrontend.preset must be a non-empty string");
      } else {
        checks.push(`preset=${product.preset}`);
      }
    }

    if (!loaded.project.targets || loaded.project.targets.length === 0) {
      errors.push("manifest.targets must list at least one target");
    } else {
      checks.push(`targets=${loaded.project.targets.join(",")}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return { ok: errors.length === 0, checks, errors };
}
