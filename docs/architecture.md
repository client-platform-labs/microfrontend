# Architecture

`microfrontend` is a composition toolkit: it makes independently delivered client apps integrate through explicit contracts, not through copy-paste host code.

## Family constraints already decided

- Runtime: Node.js 24.x LTS + TypeScript.
- CLI framework: `commander`.
- Packaging: ESM-first npm packages with a `bin` entry.
- Command loading: static core commands; heavy/optional paths via `import()`.
- Config: human-authored JSONC, validated with JSON Schema 2020-12 via Ajv.
- Documents carry `schemaVersion` and migrate before validation.

Exact family config filenames are not locked yet.

## Product shape

```text
CLI  ->  host/remote manifests  ->  contract validation  ->  runtime adapters  ->  preview/integration
```

- **CLI**: scaffold, validate, preview, doctor.
- **Contracts**: shared public surface between host and remotes (routes, shared deps, events, slots).
- **Runtime adapters**: Module Federation, native federation, iframe/web-component bridges, and others.
- **Presets**: host app and remote app templates.

## Proposed package split

- `microfrontend` CLI package
- `@.../mfe-runtime`
- `@.../mfe-contract`
- `@.../adapter-*`
- `examples/host` and `examples/remote-*`

## Inputs and outputs

| Flow | Input | Output |
| --- | --- | --- |
| `init` | app type (host/remote) | project skeleton + contract stubs |
| `add-remote` | host + remote identity | updated host composition config |
| `validate` | host + remote contracts | compatibility report |
| `preview` | local host + remotes | running integration environment |

## What this repo should own

- Host/remote domain model.
- Compatibility contracts and validation rules.
- Runtime adapters and templates.
- Local integration preview.

## What should probably live in a family kernel

- CLI bootstrap and diagnostics.
- Config/manifest load, migrate, validate.
- Plugin registry and lazy loading.
- Workspace/project discovery.

That split is pending `shared kernel boundaries`.
