# Contributing to GTKX

Start with [Development Setup](https://gtkx.dev/contributing/development) to build the workspace and run an example. Read the [Development Principles](https://gtkx.dev/contributing/principles) for package boundaries and coding and testing standards. The [architecture overview](https://gtkx.dev/contributing/architecture) helps locate the code responsible for a change.

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report conduct concerns to eugeniodepalo@gmail.com.

## Set up the workspace

The workspace needs Linux, Node.js 26.7 or later, pnpm, the pinned Rust toolchains, and native development libraries. Follow [Development Setup](https://gtkx.dev/contributing/development) for prerequisites, cloning, building, and running examples. [The CI setup action](.github/actions/setup-ci/action.yml) installs the complete CI environment.

## Submit a focused change

Use a short imperative commit subject of at most ten words. CI's `Verify workspace` check builds, tests, typechecks, and lints the affected projects; [Testing](https://gtkx.dev/contributing/testing#ci-verification-and-failure-reproduction) describes what it runs and how to reproduce a failing target. `pnpm build` emits JavaScript and declarations without checking types, so run a project's `typecheck` target to catch type errors before CI does.

Run `pnpm format` before committing. CI checks formatting as part of linting; [Development Setup](https://gtkx.dev/contributing/development#clone-and-build) covers formatting only changed files.

Follow the [pull request template](.github/PULL_REQUEST_TEMPLATE.md) and add `Closes #N` only when the pull request resolves that issue. Include a screenshot for visible UI changes.

Breaking removals require a warning in an earlier minor release. Renamed symbols use `@deprecated` with their introduction version; behavior changes need a CLI warning and an opt-in migration path. A removal-only major adds no unrelated features and never introduces a deprecation, and its migration guide changes with every deprecation. Majors follow the schedule on [Releases](https://gtkx.dev/releases).

## Add a version plan

Changes to public APIs, application behavior, or developer workflows need an Nx version plan:

```bash
pnpm plan
```

Write the changelog message for the people who will use the release. Describe observable behavior, compatibility changes, or required migrations. Omit private refactoring, dependency plumbing, and test-only changes. Publication alone does not make a package API public: `@gtkx/native` is entirely private implementation. Its internal changes need no plan; a native fix that changes application behavior should describe that effect without listing internal APIs.

Choose `major` for a breaking change, `minor` for a feature, or `patch` for a fix. When the current version is a prerelease, these choices organize the changelog while releases continue with the existing prerelease identifier. The `pre*` bumps are for maintainers starting a prerelease from a stable version.

Documentation, repository tests, benchmarks, test configuration, Nx targets, private native implementation, and files outside published packages need no plan. Other shipped source, application templates (including their tests), package manifests, and package build logic remain checked. Keep release notes focused on behavior, APIs, compatibility, and performance that framework users experience.

PR CI runs `nx release plan:check` against the PR commit range using only plans added or updated by that PR. Bot pull requests and the repository's `release/next` PR are exempt; release preparation consumes the existing plans. The exclusions live in `release.versionPlans.ignorePatternsForPlanCheck` in `nx.json`.

## Publish a release

Maintainers follow [Publishing Releases](https://gtkx.dev/contributing/releases) to prepare, review, tag, publish, and retry a release.

## Documentation and examples

[Maintaining Documentation](https://gtkx.dev/contributing/documentation) covers the website workflow. Examples demonstrate application development; retain example tests only when they teach testing. Framework regression coverage belongs in package integration suites. The Storybook example demonstrates `composeStories`, and `tutorial` consumes registry packages outside the workspace. Run its application tests from the tutorial directory.

### Documentation versions

Version manifests, pinned references, and promotion procedures live in [Maintaining Documentation](https://gtkx.dev/contributing/documentation#documentation-versions).

## Get help

Use [GitHub Discussions](https://github.com/gtkx-org/gtkx/discussions) for questions, [issues](https://github.com/gtkx-org/gtkx/issues) for bugs, and the private channel in [SECURITY.md](SECURITY.md) for vulnerabilities.
