# Roadmap

## Now

- CLI: `init`, `add-remote`, `validate`, `preview`, `doctor`
- Locked composition under `products.microfrontend` (`host` + `remotes` + `vite-federation`)
- `validate` enforces host + unique remote names/entries
- `preview` runs federation playground (Vite 7 + originjs); `--static` for legacy placeholders; `--clean`, `--write-only`, `--port` available

## Next

- Shared-dep semver intersection checks

## Later

- webpack Module Federation adapter
- Runtime contract packages

## Non-goals for v1

- webpack Module Federation preview (Vite + originjs federation playground is in scope)
- Duplicating remotes into Project Manifest
