export type MicrofrontendRemote = {
  name: string;
  entry: string;
};

export type MicrofrontendHost = {
  name: string;
  entry: string;
};

export type MicrofrontendConfig = {
  preset: string;
  adapter: "vite-federation";
  host: MicrofrontendHost;
  remotes: MicrofrontendRemote[];
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
};

export const CONFIG_FILE_NAME = "client-platform.config.jsonc";
export const MANIFEST_FILE_NAME = "client-platform.manifest.jsonc";
export const SCHEMA_VERSION = "1";
export const DEFAULT_PRESET = "host-react-vite";
export const DEFAULT_ADAPTER = "vite-federation" as const;
export const DEFAULT_HOST: MicrofrontendHost = {
  name: "host",
  entry: "./src/host.tsx",
};
export const PREVIEW_DIR = ".client-platform/microfrontend/preview";
