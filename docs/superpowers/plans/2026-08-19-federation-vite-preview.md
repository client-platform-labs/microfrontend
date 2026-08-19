# Federation Vite Real Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `microfrontend preview` (default) generate an ephemeral Vite 7 + `@originjs` host/remote playground, build it, and serve a real Module Federation preview that renders remote widgets.

**Architecture:** Keep existing static HTML preview behind `--static`. Add `src/playground/` modules that scaffold `.client-platform/microfrontend/playground/`, install deps, build remotes then host, and optionally spawn `vite preview` processes with prefixed logs and clean shutdown. Config remotes contribute **names only**; entries are ignored and never rewritten.

**Tech Stack:** Node 24+, TypeScript ESM, Commander, Vite **7.x**, React 19, `@originjs/vite-plugin-federation`, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-19-federation-vite-preview-design.md`

## Global Constraints

- Playground path: `.client-platform/microfrontend/playground/`
- Vite pin in playground: `vite@^7.0.0` (family Vite 8 exception)
- Plugin: `@originjs/vite-plugin-federation`
- Remote ports: `5001 + index` (0-based); host default `4173`
- Do not mutate `client-platform.config.jsonc`
- `--write-only` = generate + build + write `playground-status.json`; no listeners
- Adapter must be `vite-federation` for federation mode; else error pointing to `--static`
- Empty remotes → synthetic name `demo_remote` (sandbox only)

## File map

| File | Responsibility |
| --- | --- |
| `src/types.ts` | Add `PLAYGROUND_DIR`, preview mode types |
| `src/preview-static.ts` | Move current static preview implementation here |
| `src/playground/paths.ts` | Resolve playground roots |
| `src/playground/scaffold.ts` | Write workspace + host + remote templates |
| `src/playground/proc.ts` | Spawn/kill children with log prefixes |
| `src/playground/run-federation-preview.ts` | Orchestrate validate → scaffold → install → build → preview |
| `src/preview.ts` | Dispatcher: static vs federation |
| `src/cli.ts` | `--static`, `--clean` flags |
| `docs/architecture.md`, `ROADMAP.md` | Document Vite 7 exception + new flags |

---

### Task 1: Split static preview + extend types

**Files:**
- Modify: `src/types.ts`
- Create: `src/preview-static.ts` (move body from current `src/preview.ts`)
- Modify: `src/preview.ts` (temporary re-export static until Task 4; or thin wrapper)

**Interfaces:**
- Produces: `runStaticPreview(cwd, options: { port?: number; writeOnly?: boolean }): Promise<{ htmlPath: string; url?: string }>`
- Produces: `PLAYGROUND_DIR = ".client-platform/microfrontend/playground"`
- Produces: `DEFAULT_SYNTHETIC_REMOTE = "demo_remote"`
- Produces: `REMOTE_PORT_BASE = 5001`

- [ ] **Step 1: Add constants to `src/types.ts`**

Append:

```ts
export const PLAYGROUND_DIR = ".client-platform/microfrontend/playground";
export const DEFAULT_SYNTHETIC_REMOTE = "demo_remote";
export const REMOTE_PORT_BASE = 5001;
```

- [ ] **Step 2: Move static implementation to `src/preview-static.ts`**

Copy current `runPreview` from `src/preview.ts` into `src/preview-static.ts` as `runStaticPreview`. Keep HTML renderer helpers private in that file.

- [ ] **Step 3: Point `src/preview.ts` at static for now**

```ts
export { runStaticPreview as runPreview } from "./preview-static.js";
export type { PreviewOptions } from "./preview-static.js";
```

Export `PreviewOptions` from `preview-static.ts`:

```ts
export type PreviewOptions = {
  port?: number;
  writeOnly?: boolean;
  staticMode?: boolean;
  clean?: boolean;
};
```

- [ ] **Step 4: Build**

Run: `npm run build`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/preview.ts src/preview-static.ts
git commit -m "refactor: extract static microfrontend preview"
```

---

### Task 2: Playground path helpers + scaffold templates

**Files:**
- Create: `src/playground/paths.ts`
- Create: `src/playground/scaffold.ts`

**Interfaces:**
- Consumes: `PLAYGROUND_DIR`, `REMOTE_PORT_BASE` from `../types.js`
- Produces:
  - `playgroundRoot(cwd: string): string`
  - `resolveRemoteNames(remotes: Array<{ name: string }>): string[]` — names or `[DEFAULT_SYNTHETIC_REMOTE]`
  - `scaffoldPlayground(cwd: string, opts: { hostName: string; remoteNames: string[]; hostPort: number }): Promise<{ root: string; remotes: Array<{ name: string; port: number }> }>`
- Scaffold overwrites generated sources under playground (disposable).

- [ ] **Step 1: Write `src/playground/paths.ts`**

```ts
import path from "node:path";
import { PLAYGROUND_DIR } from "../types.js";

export function playgroundRoot(cwd: string): string {
  return path.join(cwd, PLAYGROUND_DIR);
}

export function hostDir(cwd: string): string {
  return path.join(playgroundRoot(cwd), "host");
}

export function remoteDir(cwd: string, name: string): string {
  return path.join(playgroundRoot(cwd), "remotes", name);
}
```

- [ ] **Step 2: Write `resolveRemoteNames` + `scaffoldPlayground` in `src/playground/scaffold.ts`**

Requirements for generated files:

**Root `package.json`:**

```json
{
  "name": "client-platform-mfe-playground",
  "private": true,
  "workspaces": ["host", "remotes/*"]
}
```

**Each remote `remotes/<name>/package.json`:** name `@playground/remote-<name>`, deps `react@^19`, `react-dom@^19`, devDeps `vite@^7`, `@vitejs/plugin-react@^4`, `@originjs/vite-plugin-federation@^1.3.9`, `typescript@^5.9`. Scripts: `"build": "vite build"`, `"preview": "vite preview --strictPort"`.

**Remote `vite.config.ts`:** federation `name: <name>`, `filename: "remoteEntry.js"`, `exposes: { "./Widget": "./src/Widget.tsx" }`, shared react singletons, `build.target: "esnext"`, `modulePreload: false`, `cssCodeSplit: false`. `preview.port` set to assigned port. `server.cors: true` / `preview.cors: true` if needed.

**Remote `src/Widget.tsx`:** export default function showing `Remote: <name>`.

**Host `package.json`:** similar deps; scripts build/preview.

**Host `vite.config.ts`:** remotes map:

```ts
remotes: {
  [name]: `http://127.0.0.1:${port}/assets/remoteEntry.js`,
  // ...
}
```

**Host `src/App.tsx`:** for each remote, `React.lazy(() => import("<name>/Widget"))` with Suspense + simple error UI. Heading includes host name.

**Host `index.html` + `src/main.tsx`:** standard Vite React mount.

Also write `tsconfig` stubs as needed for Vite.

`scaffoldPlayground` must:

1. `mkdir` playground root
2. Write root package.json
3. For each remote name at index `i`, port `REMOTE_PORT_BASE + i`, write remote tree
4. Write host tree using those ports
5. Return `{ root, remotes: [{ name, port }] }`

- [ ] **Step 3: Manual unit check via node after build (optional smoke later)**

Run: `npm run build`  
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add src/playground/paths.ts src/playground/scaffold.ts
git commit -m "feat: scaffold federation playground templates"
```

---

### Task 3: Process helpers

**Files:**
- Create: `src/playground/proc.ts`

**Interfaces:**
- Produces:
  - `runCommand(opts: { cwd: string; cmd: string; args: string[]; prefix: string; env?: NodeJS.ProcessEnv }): Promise<void>` — reject on non-zero
  - `spawnPreview(opts: { cwd: string; cmd: string; args: string[]; prefix: string; readyRegex: RegExp; timeoutMs?: number }): Promise<ChildProcess>` — resolve when stdout/stderr matches readyRegex or timeout reject
  - `killProcessTree(child: ChildProcess): Promise<void>`

- [ ] **Step 1: Implement `runCommand`**

Use `node:child_process` `spawn` with `stdio: ["ignore", "pipe", "pipe"]`, pipe lines to `console.log(\`[${prefix}] ${line}\`)`. Reject if exit code !== 0.

- [ ] **Step 2: Implement `spawnPreview`**

Same logging. Keep process detached=`false`. Resolve when `readyRegex` matches (Vite prints `Local:` / `http://127.0.0.1`). Default `timeoutMs: 60_000`.

- [ ] **Step 3: Implement `killProcessTree`**

On macOS/Linux: `child.kill("SIGTERM")`; if still alive after 2s, `SIGKILL`. Track all spawned children in an array exported via `createProcessGroup()`:

```ts
export type ProcessGroup = {
  track(child: ChildProcess): void;
  killAll(): Promise<void>;
};

export function createProcessGroup(): ProcessGroup;
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add src/playground/proc.ts
git commit -m "feat: add playground process helpers"
```

---

### Task 4: Federation orchestrator

**Files:**
- Create: `src/playground/run-federation-preview.ts`
- Modify: `src/preview.ts`
- Modify: `src/fs-utils.ts` if needed for `rm` recursive

**Interfaces:**
- Consumes: `loadProject`, `normalizeProductConfig` / `project.product`, `runValidate`, scaffold, proc helpers
- Produces: `runFederationPreview(cwd, options: PreviewOptions): Promise<{ hostUrl?: string; statusPath: string; remotes: Array<{ name: string; port: number }> }>`

- [ ] **Step 1: Implement orchestration**

Algorithm:

1. `runValidate(cwd)` — if `!ok`, throw with joined errors
2. `loadProject(cwd)` — if `!product`, throw
3. If `product.adapter !== "vite-federation"`, throw: `adapter must be vite-federation for real preview; use --static`
4. `remoteNames = resolveRemoteNames(product.remotes)`
5. If `options.clean`, `fs.rm(playgroundRoot(cwd), { recursive: true, force: true })`
6. `scaffoldPlayground(cwd, { hostName: product.host.name, remoteNames, hostPort: options.port ?? 4173 })`
7. If no `node_modules` under playground root OR `options.clean`: `runCommand({ cwd: root, cmd: "npm", args: ["install"], prefix: "playground" })`
8. For each remote: `runCommand({ cwd: remoteDir, cmd: "npm", args: ["run", "build", "-w", ...] })`  
   Prefer running via workspace from root: `npm run build -w @playground/remote-<name>` **or** `npx vite build` in remote dir. Use per-dir `npx vite build` if workspaces naming is awkward — pick one and stick to it. Recommended: `runCommand({ cwd: remotePath, cmd: "npx", args: ["vite", "build"], prefix: \`remote:${name}\` })`.
9. Build host similarly in host dir.
10. Write `playground-status.json` at playground root:

```json
{
  "ok": true,
  "hostPort": 4173,
  "hostUrl": "http://127.0.0.1:4173/",
  "remotes": [{ "name": "remote_app", "port": 5001, "entry": "http://127.0.0.1:5001/assets/remoteEntry.js" }],
  "adapter": "vite-federation",
  "vite": "7"
}
```

11. If `options.writeOnly`, return (no spawn).
12. Else `createProcessGroup()`, spawn each remote `npx vite preview --port <port> --strictPort`, wait ready; then spawn host preview; print `[microfrontend] federation preview ${hostUrl}`; register SIGINT/SIGTERM → `killAll()`; await.

Port conflict: if spawn fails with EADDRINUSE / vite strictPort error, throw mentioning the port.

- [ ] **Step 2: Wire `src/preview.ts` dispatcher**

```ts
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
```

- [ ] **Step 3: Build**

Run: `npm run build`  
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add src/playground/run-federation-preview.ts src/preview.ts
git commit -m "feat: orchestrate Vite federation playground preview"
```

---

### Task 5: CLI flags + docs

**Files:**
- Modify: `src/cli.ts`
- Modify: `docs/architecture.md`
- Modify: `ROADMAP.md`
- Modify: `README.md` (short preview section if present)

- [ ] **Step 1: Update preview command**

```ts
program
  .command("preview")
  .description("Run federation playground preview (Vite 7 + originjs)")
  .option("--port <n>", "host preview port", "4173")
  .option("--write-only", "scaffold+build only; do not keep servers")
  .option("--static", "legacy static HTML placeholder preview")
  .option("--clean", "delete playground before regenerate")
  .action(async (opts: { port: string; writeOnly?: boolean; static?: boolean; clean?: boolean }) => {
    try {
      await runPreview(process.cwd(), {
        port: Number(opts.port) || 4173,
        writeOnly: Boolean(opts.writeOnly),
        staticMode: Boolean(opts.static),
        clean: Boolean(opts.clean),
      });
    } catch (err) {
      fail(err);
    }
  });
```

- [ ] **Step 2: Update architecture + ROADMAP**

Document: default preview = federation sandbox; Vite 7 pin; `--static`; ports; no config rewrite.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/cli.ts docs/architecture.md ROADMAP.md README.md
git commit -m "feat: expose federation preview CLI flags"
```

---

### Task 6: End-to-end smoke + push

**Files:** none required beyond fixes discovered in smoke

- [ ] **Step 1: Static regression**

```bash
TMP=$(mktemp -d)
cd "$TMP"
node /ABS/microfrontend/bin/microfrontend.js init
node /ABS/microfrontend/bin/microfrontend.js add-remote remote_app
node /ABS/microfrontend/bin/microfrontend.js preview --static --write-only
test -f .client-platform/microfrontend/preview/index.html
```

Expected: file exists; exit 0

- [ ] **Step 2: Federation write-only smoke**

```bash
node /ABS/microfrontend/bin/microfrontend.js preview --write-only --clean
test -f .client-platform/microfrontend/playground/playground-status.json
test -f .client-platform/microfrontend/playground/remotes/remote_app/dist/assets/remoteEntry.js
test -d .client-platform/microfrontend/playground/host/dist
```

Expected: all exist; exit 0. First run may take several minutes for `npm install`.

- [ ] **Step 3: Optional live smoke (manual)**

```bash
node /ABS/microfrontend/bin/microfrontend.js preview --port 4173
# curl -s http://127.0.0.1:4173/ | head
# curl -sI http://127.0.0.1:5001/assets/remoteEntry.js
# Ctrl+C
```

Expected: host HTML 200; remoteEntry 200; processes exit on Ctrl+C

- [ ] **Step 4: Push**

```bash
git push origin HEAD:main
```

- [ ] **Step 5: Mark wayfinder ticket**

Update `.scratch/wayfinder-fe-cli-family/issues/13-federation-vite-real-preview.md` with implementation complete note and map “Not yet specified” remove federation implementation line.

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Default real federation preview | 4, 5 |
| `--static` legacy | 1, 5 |
| `--write-only` no listeners | 4, 5 |
| `--clean` | 4, 5 |
| Vite 7 + originjs | 2 |
| Playground path | 2 |
| Names only / no config rewrite | 4 |
| Ports 5001+i / host 4173 | 2, 4 |
| Synthetic `demo_remote` | 2 |
| Process kill on signal | 3, 4 |
| Docs Vite 7 exception | 5 |
| Smoke tests | 6 |

## Self-review notes

- No TBD placeholders left in steps.
- `PreviewOptions` defined in Task 1 and reused consistently.
- Workspace vs per-dir `npx vite`: Task 4 locks per-dir `npx vite build/preview` after root `npm install` to avoid workspace name fragility while still using workspaces for hoisting.
