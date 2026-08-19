# Roadmap

Command-shell track evolving toward host/remote contracts.

## Now

- CLI surface (locked): `init`, `add-remote`, `validate`, `preview`, `doctor`.
- Default preset (locked): `host-react-vite`.
- Composition config (locked): `products.microfrontend` with `host` + `remotes[]` (`name`/`entry`).
- Adapter default (locked): `vite-federation`.
- `validate` v1: kernel schemas + host required + unique remote name/entry.
- `preview` v1: static host shell + remote placeholders (not full Module Federation yet).

## Next

- Implement config shape on `init` and enforce `validate` rules above.
- Ship placeholder `preview` server.
- Real `add-remote` mutating `products.microfrontend.remotes`.

## Later

- Full Vite federation adapter and webpack adapter.
- Shared-dependency semver intersection checks.

## Non-goals for v1

- Forcing one microfrontend runtime beyond the default adapter direction.
- Deep multi-remote release gates.
