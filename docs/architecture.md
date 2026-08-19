# Architecture

`microfrontend` composes independently delivered client apps through explicit host/remote contracts.

## Composition (locked)

`products.microfrontend`:

- `preset` (default `host-react-vite`)
- `adapter` (default `vite-federation`)
- `host`: `{ name, entry }`
- `remotes`: `[{ name, entry }, ...]` unique by `name` and `entry`

Project Manifest: `targets` / `tooling` only.

## CLI

| Command | v1 |
| --- | --- |
| `init` | family files + host entry stub |
| `add-remote` | append remote to config |
| `validate` | kernel + host/remotes shape |
| `preview` | federation playground (default); `--static` for legacy placeholders |
| `doctor` | kernel + product checks |

### Preview

Default `preview` scaffolds a disposable federation sandbox under `.client-platform/microfrontend/playground/` using **Vite 7** (`vite@^7`) and `@originjs/vite-plugin-federation`. It reads remote **names** from config; configured `remotes[].entry` URLs are not used and config is never rewritten.

| Flag | Effect |
| --- | --- |
| (default) | Build remotes + host, serve via `vite preview` |
| `--static` | Legacy static HTML host page with placeholder mounts |
| `--write-only` | Scaffold + build only; exit without keeping servers |
| `--port <n>` | Host preview port (default `4173`) |
| `--clean` | Delete playground directory before regenerate |

Ports: host defaults to `4173`; remotes use `5001 + index` (0-based). Requires `adapter: vite-federation`; use `--static` otherwise.
