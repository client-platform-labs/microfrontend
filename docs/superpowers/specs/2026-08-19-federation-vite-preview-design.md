# Federation Vite Real Preview — Design

Date: 2026-08-19  
Product: `@client-platform/microfrontend`  
Status: approved (awaiting implementation plan)

## Goal

Upgrade `microfrontend preview` from a static HTML placeholder to a **real Module Federation** playground: a generated host Vite app loads and renders at least one local remote widget via `@originjs/vite-plugin-federation`.

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Success criteria | In-repo (CLI-generated) host + local remotes; true `import` + render |
| Plugin / Vite | **Vite 7.x** + `@originjs/vite-plugin-federation` (explicit exception vs family Vite 8 baseline) |
| Playground location | Ephemeral `.client-platform/microfrontend/playground/` (not committed by default) |
| Config remotes | Use remote **names** only; **ignore** `entry` URLs; **do not** rewrite config |
| Orchestration | `vite build` then `vite preview --strictPort` for remotes and host |

## Architecture

```
.client-platform/microfrontend/playground/
  package.json                 # private workspace root (or flat installs)
  host/                        # consumer — remotes map → localhost ports
  remotes/<remoteName>/        # one demo remote per config remotes[].name
```

Flow for default `preview`:

1. Run existing product `validate` (host + unique remote names/entries shape).
2. Resolve remote names from `products.microfrontend.remotes[]`. If empty, use a single synthetic name `demo_remote` (sandbox only; not written to config).
3. Require `adapter === "vite-federation"`; otherwise fail with guidance to use `--static`.
4. Generate/refresh playground sources (idempotent overwrite of generated files; preserve nothing user-edited — playground is disposable).
5. `npm install` in playground if `node_modules` missing or `--clean`.
6. For each remote `i`: `vite build` → `vite preview --port $((5001+i)) --strictPort`.
7. Build host with remotes pointing at `http://127.0.0.1:$((5001+i))/assets/remoteEntry.js` → `vite preview --port <hostPort>` (default `4173`).
8. Print host URL; on SIGINT/SIGTERM kill all child processes and exit.

Static mode remains available for the previous placeholder behavior.

## CLI surface

| Invokation | Behavior |
| --- | --- |
| `preview` | Federation real preview (default) |
| `preview --static` | Legacy static host + placeholder mounts |
| `preview --write-only` | Generate (+ optionally build) playground; do not keep servers running |
| `preview --port <n>` | Host preview port (default `4173`) |
| `preview --clean` | Delete playground directory, then regenerate |

`--write-only` in federation mode: generate sources, run remote+host builds, write a small `playground-status.json` (ports, remotes, build ok), exit 0 without listening. Static `--write-only` keeps current HTML-only behavior.

## Config boundary

Read from `products.microfrontend`:

- `host.name` (display / federation host `name`)
- `host.entry` (not required to exist as the playground host entry; playground uses its own `src/main.tsx`)
- `remotes[].name` (drives sandbox remote folders)
- `adapter` (must be `vite-federation` for real preview)

Do **not**:

- Mutate `client-platform.config.jsonc`
- Treat configured `remotes[].entry` as live URLs during real preview
- Require user-owned `apps/host` or remote packages in this milestone

Compatibility note (docs): family matrix still targets Vite 8 for product scaffolds; **federation playground pins Vite 7** until an adapter migration is scheduled.

## Playground contents (minimal)

**Each remote**

- React 19 component exposed as `./Widget` (shows remote name)
- `@originjs/vite-plugin-federation` with `exposes`, `shared: { react, react-dom }` singletons
- `build.target: "esnext"`, `modulePreload: false`, `cssCodeSplit: false` as required by the plugin

**Host**

- React shell that dynamically loads `remoteName/Widget` for each remote (with error boundary / failed-load message)
- Federation `remotes` map built from assigned ports
- Same shared singleton settings

**Install strategy**

- Single playground root `package.json` with npm workspaces `host` + `remotes/*`, or independent `package.json` per app with one root install script — prefer **one root with workspaces** to share `react` / `vite` installs.

## Error handling

- Validate failure → no playground mutation beyond optional leftover from prior runs
- Port in use → fail fast with the conflicting port and process hint; do not pick a random free port in v1 (keeps remotes map deterministic)
- Remote build failure → stop; print which remote failed; non-zero exit; tear down any already-started preview processes
- Child preview crash while running → kill siblings; non-zero exit
- Missing Node engine floor: warn via existing doctor baseline (`>=24`); do not soft-fail preview solely for Node 25+

## Success criteria

1. Opening the host preview URL renders ≥1 remote `Widget` on screen.
2. Network panel shows `remoteEntry.js` HTTP 200 from a remote preview origin.
3. Ctrl+C stops host and all remote preview processes.
4. `--write-only` exits without leaving listeners; builds succeed when federation deps install correctly.
5. `--static` still produces the previous placeholder HTML path.

## Non-goals

- Wiring user-owned host/remote project directories
- Rewriting `remotes[].entry` in workspace config
- Vite 8 / `@module-federation/vite` / webpack adapters
- HMR or watch rebuild loops
- Shared-dependency semver intersection validation
- Non-React frameworks in the playground

## Testing plan (implementation)

- Smoke: temp cwd → `init` → `add-remote` → `preview --write-only` → assert playground files + build artifacts / status json
- Optional longer smoke: `preview` with short timeout + HTTP GET host HTML contains remote widget text (if CI-friendly)
- Regression: `preview --static --write-only` still writes `.client-platform/microfrontend/preview/index.html`

## Open implementation details (non-blocking)

- Exact workspace layout (npm workspaces vs nested installs) — prefer workspaces
- Whether `--write-only` skips `vite preview` entirely (yes) or briefly starts then stops (no — skip listen)
- Logging: stream child stdout with `[remote:name]` / `[host]` prefixes
