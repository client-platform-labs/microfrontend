# microfrontend

Client platform microfrontend architecture and tooling toolkit.

## Vision

`microfrontend` is intended to define a practical, reusable engineering system for composing independently delivered frontend applications without losing consistency in runtime contracts, local development, or delivery workflows.

## Scope

This repository is intended to cover:

- host and remote application conventions
- local development and integration workflows
- runtime contract validation
- module composition and release compatibility checks
- CLI, adapters, templates, and demo scaffolds

This repository should not become a wrapper around a single app's integration details.

## Local development

Requires Node.js 24.x LTS. This package depends on a local `../kernel` checkout via `file:` during scaffolding.

```bash
# from sibling kernel repo first:
#   cd ../kernel && npm install && npm run build
npm install
npm run build
node ./bin/microfrontend.js --help
```

CLI surface: `init`, `add-remote`, `validate`, `preview`, `doctor`. Default preset: `host-react-vite`.

`init` writes minimal family config:

- `client-platform.config.jsonc` with `products.microfrontend`
- `client-platform.manifest.jsonc` with host role / remotes stubs

### Preview

```bash
node ./bin/microfrontend.js preview              # federation sandbox (default)
node ./bin/microfrontend.js preview --static     # legacy static HTML placeholders
node ./bin/microfrontend.js preview --write-only # scaffold + build, no servers
node ./bin/microfrontend.js preview --clean      # wipe playground before regenerate
```

Default preview requires `adapter: vite-federation` and serves host on port `4173` (remotes on `5001+`). Config is read-only; remote names drive the sandbox.

## Documents

- [Roadmap](./ROADMAP.md)
- [Architecture](./docs/architecture.md)

## Working Principles

- explicit runtime contracts
- independent delivery with controlled integration
- local developer experience matters as much as runtime composition
- framework-specific behavior should live in adapters, not the kernel
