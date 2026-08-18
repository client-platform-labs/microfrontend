# Roadmap

This is the first delivery map for `microfrontend`. Shared-kernel ownership is still an open family decision.

## Now

- Keep the repository charter current.
- Lock the domain language: host, remote, contract, runtime adapter, integration preview.
- Define the host/remote compatibility contract and versioning rules.
- Define the first CLI surface: `init`, `add-remote`, `validate`, `preview`, `doctor`.

## Next

- Ship a local MVP with one host and one remote that can start, share a contract, and fail loudly on mismatch.
- Keep framework-specific Module Federation / native federation details in adapters.
- Add an example that runs without a custom company platform.

## Later

- Add multi-remote integration tests and release compatibility gates.
- Add deployment topology presets (independent remotes vs integrated host release).
- Align package layout with the family shared kernel once that boundary is decided.

## Non-goals for v1

- Forcing one microfrontend runtime on every team.
- Replacing application routers or design systems.
- Hiding independent-delivery constraints behind a fake monolith DX.
