import path from "node:path";
import {
  ConfigError,
  doctor as kernelDoctor,
  loadWorkspaceConfig,
  WORKSPACE_CONFIG_FILENAME,
} from "@client-platform/kernel";
import { normalizeProductConfig } from "./config.js";
import { pathExists } from "./fs-utils.js";
import { CONFIG_FILE_NAME, DEFAULT_PRESET, MANIFEST_FILE_NAME } from "./types.js";

export type DoctorFinding = {
  code: string;
  message: string;
  severity: "info" | "warn" | "error";
};

export async function runDoctor(cwd: string): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];

  findings.push({
    code: "engine.node",
    message: `Node.js ${process.versions.node} (product baseline >=24)`,
    severity: Number(process.versions.node.split(".")[0]) >= 24 ? "info" : "warn",
  });

  for (const f of await kernelDoctor(cwd)) {
    findings.push({
      code: f.code,
      message: `[kernel] ${f.message}`,
      severity: f.severity,
    });
  }

  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  const manifestPath = path.join(cwd, MANIFEST_FILE_NAME);
  const hasConfig = await pathExists(configPath);
  const hasManifest = await pathExists(manifestPath);

  findings.push({
    code: "config.workspace",
    message: hasConfig
      ? `found ${CONFIG_FILE_NAME}`
      : `missing ${CONFIG_FILE_NAME} (run microfrontend init)`,
    severity: hasConfig ? "info" : "warn",
  });
  findings.push({
    code: "config.manifest",
    message: hasManifest
      ? `found ${MANIFEST_FILE_NAME}`
      : `missing ${MANIFEST_FILE_NAME} (run microfrontend init)`,
    severity: hasManifest ? "info" : "warn",
  });

  if (hasConfig) {
    try {
      const workspace = await loadWorkspaceConfig(cwd);
      const product = normalizeProductConfig(workspace.products?.microfrontend);
      if (!product) {
        findings.push({
          code: "product.composition",
          message: `products.microfrontend invalid (expected preset/host/remotes, default preset ${DEFAULT_PRESET})`,
          severity: "error",
        });
      } else {
        findings.push({
          code: "product.composition",
          message: `host=${product.host.name} remotes=${product.remotes.length} adapter=${product.adapter}`,
          severity: "info",
        });
      }
    } catch (err) {
      const message =
        err instanceof ConfigError || err instanceof Error ? err.message : String(err);
      findings.push({
        code: "product.composition",
        message: `unable to read ${WORKSPACE_CONFIG_FILENAME}: ${message}`,
        severity: "error",
      });
    }
  }

  return findings;
}
