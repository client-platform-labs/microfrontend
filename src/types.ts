export type MicrofrontendConfig = {
  preset: string;
  role: "host" | "remote";
  remotes?: string[];
};

export type WorkspaceConfigFile = {
  schemaVersion: string;
  products?: {
    microfrontend?: Partial<MicrofrontendConfig> & Record<string, unknown>;
    [product: string]: unknown;
  };
  plugins?: string[];
};

export type ProjectManifestFile = {
  schemaVersion: string;
  targets?: string[];
  tooling?: string[];
  role?: string;
  remotes?: string[];
};

export const CONFIG_FILE_NAME = "client-platform.config.jsonc";
export const MANIFEST_FILE_NAME = "client-platform.manifest.jsonc";
export const SCHEMA_VERSION = "1";
export const DEFAULT_PRESET = "host-react-vite";
export const DEFAULT_ROLE = "host" as const;
