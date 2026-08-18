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

## Planned Shape

The expected product shape is:

- a CLI for scaffolding hosts/remotes and validating contracts
- reusable runtime and adapter packages
- presets for mainstream frontend stacks
- shared config and manifest conventions
- examples for local development, integration, and release

## Initial Milestones

1. Define the host/remote domain model and compatibility boundaries.
2. Decide the core runtime contract and adapter responsibilities.
3. Design the package split between CLI, runtime, presets, and plugins.
4. Build a minimal host-plus-remote demo for validation.

## Documents

- [Roadmap](./ROADMAP.md)
- [Architecture](./docs/architecture.md)

## Working Principles

- explicit runtime contracts
- independent delivery with controlled integration
- local developer experience matters as much as runtime composition
- framework-specific behavior should live in adapters, not the kernel
