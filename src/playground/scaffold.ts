import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SYNTHETIC_REMOTE, REMOTE_PORT_BASE } from "../types.js";
import { hostDir, playgroundRoot, remoteDir } from "./paths.js";

export function resolveRemoteNames(remotes: Array<{ name: string }>): string[] {
  return remotes.length > 0
    ? remotes.map((remote) => remote.name)
    : [DEFAULT_SYNTHETIC_REMOTE];
}

/** npm-safe workspace package name; folder path and federation `name` keep the original casing. */
export function playgroundRemotePackageName(name: string): string {
  return `@playground/remote-${name.toLowerCase()}`;
}

export async function scaffoldPlayground(
  cwd: string,
  opts: { hostName: string; remoteNames: string[]; hostPort: number },
): Promise<{ root: string; remotes: Array<{ name: string; port: number }> }> {
  const root = playgroundRoot(cwd);
  await mkdir(root, { recursive: true });

  const remotes = opts.remoteNames.map((name, i) => ({
    name,
    port: REMOTE_PORT_BASE + i,
  }));

  await writeText(
    path.join(root, "package.json"),
    stringifyJson({
      name: "client-platform-mfe-playground",
      private: true,
      workspaces: ["host", "remotes/*"],
    }),
  );

  for (const remote of remotes) {
    await writeRemoteApp(remoteDir(cwd, remote.name), remote.name, remote.port);
  }

  await writeHostApp(hostDir(cwd), opts.hostName, opts.hostPort, remotes);

  return { root, remotes };
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeText(filePath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}

function playgroundPackageJson(name: string): string {
  return stringifyJson({
    name,
    private: true,
    type: "module",
    scripts: {
      build: "vite build",
      preview: "vite preview --strictPort",
    },
    dependencies: {
      react: "^19",
      "react-dom": "^19",
    },
    devDependencies: {
      vite: "^7",
      "@vitejs/plugin-react": "^4",
      "@originjs/vite-plugin-federation": "^1.3.9",
      typescript: "^5.9",
    },
  });
}

function tsconfigJson(): string {
  return stringifyJson({
    compilerOptions: {
      target: "ES2022",
      useDefineForClassFields: true,
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
    },
    include: ["src"],
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function indexHtml(title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

function viteEnvDts(): string {
  return `/// <reference types="vite/client" />\n`;
}

function sharedFederationConfig(): string {
  return `shared: {
        react: { singleton: true },
        "react-dom": { singleton: true },
      },`;
}

function viteBuildAndCors(previewPort: number): string {
  return `build: {
    target: "esnext",
    modulePreload: false,
    cssCodeSplit: false,
  },
  server: {
    cors: true,
  },
  preview: {
    port: ${previewPort},
    strictPort: true,
    cors: true,
  },`;
}

async function writeRemoteApp(
  dir: string,
  name: string,
  port: number,
): Promise<void> {
  await writeText(
    path.join(dir, "package.json"),
    playgroundPackageJson(playgroundRemotePackageName(name)),
  );
  await writeText(path.join(dir, "vite.config.ts"), remoteViteConfig(name, port));
  await writeText(path.join(dir, "tsconfig.json"), tsconfigJson());
  await writeText(path.join(dir, "index.html"), indexHtml(`Remote ${name}`));
  await writeText(path.join(dir, "src/vite-env.d.ts"), viteEnvDts());
  await writeText(path.join(dir, "src/Widget.tsx"), remoteWidget(name));
  await writeText(path.join(dir, "src/main.tsx"), reactMount("./Widget", "Widget"));
}

function remoteWidget(name: string): string {
  return `export default function Widget() {
  return <div>Remote: {${JSON.stringify(name)}}</div>;
}
`;
}

function reactMount(componentImport: string, componentId: string): string {
  return `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ${componentId} from ${JSON.stringify(componentImport)};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <${componentId} />
  </StrictMode>,
);
`;
}

function remoteViteConfig(name: string, port: number): string {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: ${JSON.stringify(name)},
      filename: "remoteEntry.js",
      exposes: {
        "./Widget": "./src/Widget.tsx",
      },
      ${sharedFederationConfig()}
    }),
  ],
  ${viteBuildAndCors(port)}
});
`;
}

async function writeHostApp(
  dir: string,
  hostName: string,
  hostPort: number,
  remotes: Array<{ name: string; port: number }>,
): Promise<void> {
  await writeText(path.join(dir, "package.json"), playgroundPackageJson("@playground/host"));
  await writeText(
    path.join(dir, "vite.config.ts"),
    hostViteConfig(hostName, hostPort, remotes),
  );
  await writeText(path.join(dir, "tsconfig.json"), tsconfigJson());
  await writeText(path.join(dir, "index.html"), indexHtml(hostName));
  await writeText(path.join(dir, "src/vite-env.d.ts"), viteEnvDts());
  await writeText(path.join(dir, "src/remotes.d.ts"), hostRemotesDts(remotes));
  await writeText(path.join(dir, "src/App.tsx"), hostApp(hostName, remotes));
  await writeText(path.join(dir, "src/main.tsx"), reactMount("./App", "App"));
}

function hostViteConfig(
  hostName: string,
  hostPort: number,
  remotes: Array<{ name: string; port: number }>,
): string {
  const remotesMap = remotes
    .map(
      (remote) =>
        `        ${JSON.stringify(remote.name)}: ${JSON.stringify(
          `http://127.0.0.1:${remote.port}/assets/remoteEntry.js`,
        )}`,
    )
    .join(",\n");

  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: ${JSON.stringify(hostName)},
      remotes: {
${remotesMap}
      },
      ${sharedFederationConfig()}
    }),
  ],
  ${viteBuildAndCors(hostPort)}
});
`;
}

function hostRemotesDts(remotes: Array<{ name: string; port: number }>): string {
  if (remotes.length === 0) {
    return "";
  }
  return remotes
    .map(
      (remote) => `declare module ${JSON.stringify(`${remote.name}/Widget`)} {
  import type { ComponentType } from "react";
  const Widget: ComponentType;
  export default Widget;
}
`,
    )
    .join("\n");
}

function hostApp(
  hostName: string,
  remotes: Array<{ name: string; port: number }>,
): string {
  if (remotes.length === 0) {
    return `export default function App() {
  return (
    <div>
      <h1>Host: {${JSON.stringify(hostName)}}</h1>
    </div>
  );
}
`;
  }

  const lazyDecls = remotes
    .map(
      (remote, i) =>
        `const Remote${i} = lazy(() => import(${JSON.stringify(`${remote.name}/Widget`)}));`,
    )
    .join("\n");

  const mounts = remotes
    .map(
      (remote, i) => `      <RemoteErrorBoundary name={${JSON.stringify(remote.name)}}>
        <Suspense fallback={<p>Loading {${JSON.stringify(remote.name)}}…</p>}>
          <Remote${i} />
        </Suspense>
      </RemoteErrorBoundary>`,
    )
    .join("\n");

  return `import { Component, lazy, Suspense, type ReactNode } from "react";

${lazyDecls}

class RemoteErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <p>Failed to load remote {this.props.name}</p>;
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <div>
      <h1>Host: {${JSON.stringify(hostName)}}</h1>
${mounts}
    </div>
  );
}
`;
}
