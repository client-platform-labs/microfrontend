# Roadmap

Command-shell track for Client Platform Labs v1.

## Now

- CLI surface (locked, mostly stubbed): `init`, `add-remote`, `validate`, `preview`, `doctor`.
- Default preset (locked): `host-react-vite`.
- `init` / `doctor` / `validate` should write and check family config; other commands may stub.

## Next

- Host + remote contract model.
- Real `preview` against one federation adapter.

## Later

- Multi-remote gates and deployment topology presets.

## Non-goals for v1

- Deep runtime implementation beyond stubs.
- Forcing one microfrontend runtime on every team.
