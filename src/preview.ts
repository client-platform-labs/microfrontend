import { runStaticPreview } from "./preview-static.js";
import { runFederationPreview } from "./playground/run-federation-preview.js";
import type { PreviewOptions } from "./preview-static.js";

export type { PreviewOptions };

export async function runPreview(cwd: string, options: PreviewOptions = {}) {
  if (options.staticMode) {
    return runStaticPreview(cwd, options);
  }
  return runFederationPreview(cwd, options);
}
