# Tooling implementation

Implementation branch: `chore/tooling-modernization`. The audit reports describe the original September 27 snapshot; this document records the resulting changes and their verification limits. Changes are local and have not been published, deployed, or applied to GitHub or npm settings.

## Implemented changes

| Findings | Change | Verification |
| --- | --- | --- |
| NX-1, NX-5 | Native tasks hash the CI image, actual runtime and native libraries, compiler/toolchain flags, Cargo configuration, and staged artifact bundle. Shared runtime inputs include library bytes and GIR contents; cached tests and coverage also hash the actual native addon outputs. | Stable inputs hit; changing only the image misses; restoring the original identity hits and the addon loads. Node version, compiler flags, and GIR content probes change the fingerprint. |
| NX-2 | CLI fixture configurations are excluded from Nx plugin project discovery. Fixtures remain CLI inputs and select CLI and MCP consumers. | The three accidental `@audit/*` projects disappear; the graph has 31 projects. Existing configured-props integration passes. |
| NX-3 | CI resolves Git revisions once, forwards them through the container, runs affected lint/typecheck, and plans ordinary test groups before starting matrices. Shared tooling changes force full selection; coverage stays complete. Main and weekly CI run full verification. | Actual Nx full, empty, leaf, fixture, shared-config, and native selections inspected. Missing revisions fail. Coverage example selection matches all six example projects. |
| NX-4 | Pure tooling targets avoid native/codegen prerequisites. Ordinary tests build their dependency graph; CLI/MCP retain compiled integration prerequisites. | ESLint tests reduce from 23 tasks to one; components use ten. Existing ESLint, components, create-gtkx, and CLI integration suites pass. |
| CI-01 | Tagging follows successful main CI. Publication verifies the exact release merge commit, current-head review by a writer, successful CI aggregate, and Sonar/CodeQL checks before accepting its recorded image. | Invalid/nonrelease checkout rejection checked locally. Successful hosted gate and permissions require a real release candidate. |
| CI-02 | Already-required `test` rejects ASAN, documentation, tooling-lint, and Rust advisory failures. New `ci-success` checks the full verification chain and preserves accepted image identity. | 114 extracted aggregate-shell cases cover success, failure, cancellation, missing classifications, and unexpected skips. Image consumers explicitly handle intentionally skipped build ancestors. |
| CI-03 | x64 and ARM release builds upload binary, generated JS, declarations, and checksums. Both architectures install and execute consumers using those exact bundles. Final publication requires architecture-independent wrappers to agree. | Clean x64 staging and complete installed-consumer rehearsal pass with local generated wrappers removed first. Invalid/missing bundle checksums fail. ARM remains a hosted check. |
| CI-04, CI-10 | Ubuntu is digest-pinned; Node and rustup downloads are checksum-verified. CI records package/toolchain inventory, refreshes system packages weekly, resolves one digest per run, and promotes only a verified main image. Fork image builds are shared artifacts. | Official download hashes checked; Dockerfile parsed without an engine. Seven image-planning cases pass. Hosted image build/load and ARM execution remain outstanding. |
| CI-06 | All versions share one publish queue. Packages publish under version-specific tags, then a complete visible package family advances its shared channel monotonically. | Real Verdaccio scenarios cover incomplete publication, partial old-version retry, idempotent promotion, delayed visibility, and consumer installation from the promoted channel. The final GitHub-release retry rechecks exact versions/channels; its default verifier also passes from a clean archive without generated files or dependencies. |
| CI-08 | Added pinned actionlint, ShellCheck for workflows/composites/scripts, Docker build checks, and cross-file toolchain-version checks. | Actionlint/ShellCheck pass; seven toolchain comparisons pass and four isolated drift cases fail. Docker build checks are configured for hosted CI. |
| Q1, Q2, Q6 | Vue typechecking and linting run; forbidden assertions and stale lint suppressions are errors. | Existing ESLint suite passes 96 cases; temporary invalid Vue script/template inputs fail; real website typechecking passes. |
| Q3 / NX-6 | pnpm uses a one-day dependency cooldown with narrowly scoped first-party exceptions for release rehearsals. | Frozen installation and real fresh-version consumer installs pass. |
| Q4, Q5 | Both default and strict production Knip run. Published packages declare direct React type ownership and actual CLI optional peers. | Both Knip configurations pass; strict production discovery covers 20 published packages; seven packed manifests inspected. |
| BT-01 | Normal native builds, Clippy, and sanitizer build/restore commands use Cargo's committed lockfile. | Native builds, locked Clippy, and the complete sanitizer suites pass. |
| BT-02 | Coverage shards upload structured and raw diagnostics after failures with fourteen-day retention. Structured artifact paths retain the layout consumed by the merger. | Workflow/shell checks pass; a failing hosted shard should confirm retained artifacts. |
| BT-04 | RustSec auditing blocks vulnerabilities/unsoundness, with an empty explicit exception policy. CI retains the dependency license inventory for review. | Actual committed dependency graph reports zero vulnerabilities and warnings. License approval remains a maintainer review responsibility. |
| BT-05 | Weekly compatibility jobs use a verified main commit/image, exercise the minimum declared Node version, and run the existing query-performance suite. | Pinned Node 26.7.0 download, checksum, TS/JS consumer builds, native launches, and tests pass. Five performance tests pass and emit JSON. |

The final review also added the four tracked native JS wrappers to source coverage classification and both coverage producers. Generated native wrappers remain excluded from that added source list. Vitest coverage groups now select projects in the root configuration rather than through `--project`, which made workspace-relative include patterns miss source files in actual shard blobs. Read-only discovery confirms core, CLI, and MCP groups are disjoint and together contain all 587 test files. Actual group probes ran 45 existing tests through three blobs and the merge; each blob and merged report retained the same 707 source paths as the unfiltered report. Ten real subprocess profiles retained CLI/MCP source mappings and native binding coverage. This validates report completeness and exercised paths, not a whole-suite coverage percentage. Cached local coverage also keys its group/shard/merge controls.

## Validation record

The broad local checks completed successfully:

- `pnpm lint`: 31 projects, 69 tasks, including locked Rust lint and both Knip configurations.
- `pnpm typecheck`: 30 projects, 62 tasks, including Vue.
- Documentation build: 27 tasks, including generated reference and website output.
- Ordinary tests outside CLI/MCP: 19 projects, 48 tasks. Full MCP suite: 21 files, 73 tests.
- Full sanitizer execution: 1,324 tests across 73 files pass under ASAN/LSAN; the normal native addon is rebuilt with `--locked` afterward.
- Existing focused integration suites: ESLint 96 tests, create-gtkx 41, components 132, configured-props 19, query performance five.
- Complete release consumer rehearsal on Node 26.7.0: 20 published package shapes, TypeScript and JavaScript scaffolds, builds, native application launches, tests, delayed registry visibility, and channel retry/error paths.
- Complete clean staged x64 rehearsal: exact binary, JS wrapper, and declarations are restored and verified in installed TypeScript and JavaScript consumers.
- Workflow and shell checks, Dockerfile parsing, version consistency, Cargo advisory audit, graph/fingerprint probes, frozen lockfile validation, and whitespace checks.

Language tools were invoked through `mise exec --`. A temporary shim exposed the already-installed Corepack pnpm entrypoint; temporary official checker binaries avoided global installation changes. No Docker/Podman engine operation or workstation configuration change was made.

## External work and deliberate deferrals

[Repository settings](./repository-settings.md) includes current read-only evidence and concrete JSON payloads for required checks, action SHA enforcement, push protection, release/Pages environments, tag protection, and release immutability. Apply settings after reviewing their consequences and observing the new workflow contexts. npm package-side trusted-publisher bindings and Nx Cloud credential scopes still require owner-side verification. The `npm-release` environment must be aligned with every package's trusted-publisher configuration before release.

CI-05 needs an actual Dependabot image rebuild. Current GitHub documentation permits explicit permission increases; the workflows request package write scope, so a read-only-token failure was not established. Read-only repository metadata also confirms that the separate Dependabot secret set contains `SONAR_TOKEN`; no secret value was accessed.

CI-09 now has an explicit safe contribution procedure in [tooling policy](../../tooling-policy.md). Fork verification remains unprivileged and does not receive the Sonar token. Authenticated Sonar remains a required external check; reviewed contributions need an internal branch/PR until a separate trusted scanner path is implemented and observed. This is a documented operational path, not automatic fork Sonar support.

NX-7 generator caching, bootstrap optimization, and BT-03 shard retuning remain evidence-driven follow-ups. A controlled TypeScript probe demonstrated that ordinary incremental build mode does not restore deleted output files while its build-info file remains; forced bootstrap compilation is intentionally retained. Shard counts and worker isolation remain unchanged until representative hosted timing and flake data justify tuning.

Q7 / NX-8 `verifyDepsBeforeRun` stays disabled because release rehearsals intentionally rewrite manifests and the lockfile temporarily. Frozen CI installs remain mandatory. BT-06 does not require a current Vite API migration; existing native Vite consumer builds continue to validate compatibility.

Minimum Node compatibility is exercised. The oldest GTK/Adwaita/glibc distribution baseline still needs an explicit support policy and an acceptance image; current x64/ARM workflow configuration must not be read as proof of compatibility with an older ABI.

Before considering hosted acceptance complete, observe an ordinary PR, docs-only PR, image reuse, refreshed multiarch image, failed shard diagnostics, fork and Dependabot contributions, ARM staged consumers, and the exact-commit release gate. The first npm release must verify real package-scoped OIDC channel-management authorization. Its implementation follows the [official npm registry API](https://api-docs.npmjs.com/); local registry tests do not prove production credentials or settings.
