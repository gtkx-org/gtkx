# Contributing to GTKX

Start with [Development Setup](https://gtkx.dev/contributing/development) to build the workspace and run an example. Read the [Development Principles](https://gtkx.dev/contributing/principles) for package boundaries and coding and testing standards. The [architecture overview](https://gtkx.dev/contributing/architecture) helps locate the code responsible for a change.

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report conduct concerns to eugeniodepalo@gmail.com.

## Set up the workspace

The workspace needs Linux, Node.js 26.7 or later, pnpm, the pinned Rust toolchains, and native development libraries. Follow [Development Setup](https://gtkx.dev/contributing/development) for prerequisites, cloning, building, and running examples. [.github/docker/Dockerfile](.github/docker/Dockerfile) records the complete CI environment.

## Submit a focused change

Use a short imperative commit subject of at most ten words. Before opening a pull request, run the checks relevant to the change:

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

Include a screenshot for visible UI changes. Keep the pull request description empty or use `Closes #N` to link the issue it closes.

Breaking removals require a warning in an earlier minor release. Renamed symbols use `@deprecated` with their introduction version; behavior changes need a CLI warning and an opt-in migration path. A removal-only major adds no unrelated features, and its migration guide changes with every deprecation.

## Add a version plan

Changes to published packages need an Nx version plan:

```bash
pnpm plan
```

Write the changelog message for the people who will use the release.

Choose `major` for a breaking change, `minor` for a feature, or `patch` for a fix. During the beta, these choices organize the changelog; releases continue on the beta train until a maintainer changes it. The `pre*` bumps are for maintainers starting a prerelease from a stable version.

Documentation, tests, and files outside `packages/` need no plan. Bot pull requests are exempt. CI reports a missing plan for other published-package changes, but the check is advisory so changes that need no changelog entry can still merge.

## Publish a release

Maintainers follow [Publishing Releases](https://gtkx.dev/contributing/releases) to prepare, review, tag, publish, and retry a release.

## Documentation and examples

[Maintaining Documentation](https://gtkx.dev/contributing/documentation) covers the website workflow. Examples provide executable integration coverage. `examples/tutorial` consumes registry packages outside the workspace; run `pnpm tutorial` to validate it against the working tree.

### Documentation versions

Version manifests, pinned references, and promotion procedures live in [Maintaining Documentation](https://gtkx.dev/contributing/documentation#documentation-versions).

## Get help

Use [GitHub Discussions](https://github.com/gtkx-org/gtkx/discussions) for questions, [issues](https://github.com/gtkx-org/gtkx/issues) for bugs, and the private channel in [SECURITY.md](SECURITY.md) for vulnerabilities.
