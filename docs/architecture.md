# Architecture

`microfrontend` composes independently delivered client apps through explicit host/remote contracts.

## Family constraints

- Node.js 24.x LTS + TypeScript + `commander`
- `@client-platform/kernel` for config/manifest/doctor
- Workspace Config / Project Manifest JSONC + Ajv
- Default web stack: React 19 + Vite 8

## Composition (locked)

Declared under `products.microfrontend` in `client-platform.config.jsonc`:

- `preset` (default `host-react-vite`)
- `adapter` (default `vite-federation`)
- `host`: `{ name, entry }`
- `remotes`: `[{ name, entry }, ...]` unique by `name`

Project Manifest carries `targets` / `tooling` only.

## CLI

| Command | v1 behavior |
| --- | --- |
| `init` | write family files + composition stub |
| `validate` | kernel validate + host/remotes shape |
| `add-remote` | mutate remotes list (next) |
| `preview` | static host + placeholders (not full MF) |
| `doctor` | kernel doctor + product checks |

## Packages

- `@client-platform/microfrontend` (bin `microfrontend`)
- future: runtime/contract/adapter packages
