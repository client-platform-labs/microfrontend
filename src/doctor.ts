import path from "node:path";
import { doctor as kernelDoctor } from "@client-platform/kernel";
import { pathExists } from "./fs-utils.js";
import { CONFIG_FILE_NAME, MANIFEST_FILE_NAME } from "./types.js";

export type DoctorFinding = {
  code: string;
  message: string;
  severity: "info" | "warn" | "error";
};

export async function runDoctor(cwd: string): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];

  const major = Number(process.versions.node.split(".")[0]);
  if (Number.isNaN(major) || major < 24) {
    findings.push({
      code: "engine.node",
      message: `Node.js ${process.versions.node} is below the required 24.x LTS`,
      severity: "error",
    });
  } else {
    findings.push({
      code: "engine.node",
      message: `Node.js ${process.versions.node}`,
      severity: "info",
    });
  }

  for (const f of await kernelDoctor(cwd)) {
    findings.push({
      code: f.code,
      message: `[kernel] ${f.message}`,
      severity: f.severity,
    });
  }

  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  const manifestPath = path.join(cwd, MANIFEST_FILE_NAME);
  findings.push({
    code: "config.workspace",
    message: (await pathExists(configPath))
      ? `found ${CONFIG_FILE_NAME}`
      : `missing ${CONFIG_FILE_NAME} (run microfrontend init)`,
    severity: (await pathExists(configPath)) ? "info" : "warn",
  });
  findings.push({
    code: "config.manifest",
    message: (await pathExists(manifestPath))
      ? `found ${MANIFEST_FILE_NAME}`
      : `missing ${MANIFEST_FILE_NAME} (run microfrontend init)`,
    severity: (await pathExists(manifestPath)) ? "info" : "warn",
  });

  return findings;
}
