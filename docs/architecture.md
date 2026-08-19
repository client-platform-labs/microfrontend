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
| `preview` | static host page + placeholders |
| `doctor` | kernel + product checks |
