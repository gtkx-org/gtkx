# GTKX 2.0 tooling audit

Audited 2026-09-27 at commit `c43a7ff610773879b0115e5bd6be60c1638c9702`, for the December 2026 release. Repository configuration, resolved Nx graphs, selected executable checks, live GitHub/Sonar settings, current official documentation, and actual OSS configurations were reviewed in parallel. The highest-impact conclusions received an independent second pass.

**Keep the current toolchain. Correct the verification gaps, then make CI selective.** GTKX already has modern TypeScript and ESLint configuration, strong native integration coverage, isolated consumer installation tests, sharded V8 coverage, OIDC publishing, and pinned Actions. The largest opportunities are trustworthy caching, complete release gates, and avoiding unnecessary jobs and prerequisites. There is no evidence here that changing build systems or adding many more scanners would improve the release.

This report recommends five P1 items to close before 2.0. P1 means a material gap in verification or release acceptance, not an observed outage or compromise. P2 covers worthwhile correctness, reliability, efficiency, and hardening work. P3 covers optional hygiene, experiments, and future migrations. At the audit snapshot, no implementation or repository settings had been changed; only this audit package had been added.

Implementation progress and validation are recorded separately in [the implementation report](./implementation.md); the findings below preserve the original audit snapshot.

## Release priorities

| Priority | Finding | Evidence and consequence | Acceptance criterion |
| --- | --- | --- | --- |
| P1 · NX-1 | Native build and Rust lint omit environment identity from cache keys | Resolved native inputs contain source, Cargo.lock, declared Rust toolchain, architecture, and JS dependencies, but omit the CI image and relevant compiler/toolchain overrides. An environment-only change can reuse a result from another environment. | Unchanged inputs hit; changes to image, architecture, or relevant compiler flags miss; restored addon loads in the intended environment. |
| P1 · NX-2 | CLI fixture packages escape CLI project ownership | Three `@audit/*` fixture packages become independent Nx projects with no dependency edges to CLI. A fixture-file affected probe selected only the fixture and root, omitting `@gtkx/cli`; nested-project exclusion also creates a CLI cache-input gap. | Fixtures belong to CLI; the same probe selects CLI and a meaningful fixture change reruns its existing integration checks. |
| P1 · CI-01 | Publication does not require successful verification of the exact release commit | Tagging/dispatch runs independently of CI. Publish verifies tag/version/draft, then depends on native builds. The release runbook explicitly uses admin bypass, so manual checking is part of the current safety boundary. | An unverified release SHA cannot publish; a fully verified candidate and its safe partial-publication retry can. |
| P1 · CI-02 | ASAN and docs run without being required to merge | The live Default ruleset omits both jobs; current required aggregates do not include them. A failed native memory check or docs build can therefore coexist with passing required checks. | Required checks or a stable aggregate reject an expected ASAN/docs failure and correctly handle deliberate skips. |
| P1 · CI-03 | Both exact native release artifacts lack runtime acceptance before publication | The release builds x64 and arm64; normal consumer acceptance is x64-only and builds its own binaries. ARM compilation does not prove installed-package load or execution. | Install and run a real headless consumer using the exact staged release binaries on both architectures before publication. |

Evidence, limitations, remediation, and validation details are in [Nx](./nx.md) and [CI/release](./ci-release.md). These findings establish missing guarantees; they do not establish a historical stale-cache failure, broken ARM binary, or untested published release.

## Tool-by-tool assessment

| Area | Retain | Recommended work |
| --- | --- | --- |
| Nx | Inferred targets, aligned plugins, declared outputs, shared inputs, uncached side-effectful release tasks | Fix NX-1/NX-2/NX-5; introduce affected planning; scope prerequisites; measure generator/bootstrap overhead. |
| GitHub Actions | SHA-pinned actions, explicit permissions, timeouts, fail-closed test aggregates, hosted runners | Require ASAN/docs; add exact-SHA release eligibility; lint workflow/shell configuration; define safe fork analysis. |
| Knip | Existing blocking default check, deliberate public entrypoints, targeted ignores | Pilot a separately configured production/strict pass. Default Knip passed; raw strict findings are not a defect list. |
| ESLint | Flat config, typed strict rules, project service, React/async/test and boundary rules | Enforce the project's prohibited double assertions and definite assignment; add Vue coverage; promote stale suppression diagnostics if desired. |
| TypeScript | Strict flags, project references, isolated declarations, source-condition development, packed-consumer checks | Replace website's effective `nx:noop` with real Vue-aware typechecking. Ordinary TS file membership was complete in the inspected scan. |
| Vite | Rolldown configuration, hook filters, lazy compiler loading, custom native dev/build integration | Keep a compatibility watch for future environment APIs. No current Vite migration blocker was found. |
| Vitest | Real GTK/native integration, process isolation, V8 coverage, project/shard reports, subprocess coverage | Retain failure diagnostics; measure shard balance and setup cost; schedule the existing performance suite. |
| Cargo/NAPI | Pinned stable/nightly toolchains, Cargo.lock, Clippy/rustfmt, native integration and ASAN/LSAN | Enforce `--locked`; define a Rust advisory/license policy; verify actual artifact/platform compatibility. |
| Docker/Podman | Native architecture builds, scoped BuildKit caches, digest assembly, restricted rootless test containers | Review image refreshes, pin/propagate accepted digests, record native package versions, verify toolchain downloads. |
| pnpm/dependencies | Frozen lockfile installs, catalogs, workspace protocol, package-manager integrity, explicit build permission and trust policy | Restore a deliberate package-age policy with scoped first-party registry exceptions; review local stale-dependency handling. |
| Release/SDLC | Nx version plans, draft-first GitHub releases, OIDC/provenance, Verdaccio/tutorial acceptance, retry handling | Serialize shared npm channels and make promotion monotonic; align runbook/rulesets; consider immutable releases, tag policy, push protection and enforced Action pinning. |
| Sonar/CodeQL | Required Sonar gate; Actions, JS/TS, and Rust CodeQL; weekly source analysis | Preserve existing coverage semantics while introducing affected execution; avoid redundant scanners without a distinct purpose. |

The effective website target is `nx:noop`, and all 20 Vue SFCs are ESLint-ignored. The real ESLint configuration also accepted both prohibited assertion forms in in-memory probes. These are demonstrated automation gaps, not claims of current source violations. See [Q1–Q2](./quality.md).

The required remote Sonar gate was verified: new-code coverage at least 80%, measured 86.7%, with the project gate passing. Missing root Vitest thresholds therefore do not establish a missing coverage gate. See [the settings snapshot](./evidence.json).

## Nx affected rollout

Use `nx affected -t ...` for graph-aware task execution and `nx show projects --affected ...` for planning. Merely replacing `run-many` after every matrix job has started will leave much of the setup cost intact. Official guidance covers last-successful-main selection, Git history, and conservative lockfile handling. [Nx affected](https://nx.dev/docs/features/ci-features/affected), [Nx CI setup](https://nx.dev/docs/getting-started/setup-ci).

Recommended sequence:

1. Repair native hashing and fixture ownership. Add actual local runtime/library identity where environment variable names currently hash as unset. Validate through existing integration scenarios, not private-helper unit tests.
2. Resolve base/head once, with enough Git history, and forward `NX_BASE`/`NX_HEAD` through the container helper. Use the last successful main verification as the recovery baseline; canceled or failed runs must not drop earlier changes. Preserve the separate review-oriented base/head policy for version plans.
3. Run affected planning alongside existing full checks initially. Verify changes to a leaf package, copied fixture, shared config, lockfile, Rust source, docs, and workflow definitions. Include fork PRs, empty selections, PR merge commits, and failed/canceled main recovery.
4. Reduce prerequisites before optimizing concurrency. An `@gtkx/eslint:test` graph currently expands into 23 tasks, including 19 builds and the native addon. Preserve required compiled CLI/generated-binding prerequisites for integration families that consume them.
5. Generate only the expensive test job groups that are needed. Keep a deliberate policy for whole-workspace Knip, published-consumer acceptance, native canaries, and full coverage. Do not report partial coverage as a complete workspace baseline or allow skipped jobs to make an incomplete run pass.
6. Retain full verification for release candidates and a periodic baseline. Adopt lockfile dependency scoping and more aggressive generator caching only after representative change/restoration cases prove them sound.

The authoritative graph probe for a forms source file selected 3 of 34 projects, but this does not imply a 91% speedup: root-wide checks, dependencies, and uncached setup remain. Full proof and commands are in [NX-1 through NX-7](./nx.md).

## Measured CI baseline

The latest completed successful PR run inspected, [PR #764](https://github.com/gtkx-org/gtkx/actions/runs/36329827600), took **19m47s**. It contained **52 job records, including four skipped jobs**, and about **406.4 aggregate successful job-minutes**. CLI coverage used **23 jobs and 272.0 job-minutes**, with individual jobs ranging from **7m51s to 16m58s**.

This is one observed run, not a billing estimate or a representative performance distribution. It identifies where to measure first: CLI coverage, repeated install/build/codegen prerequisites, and whether unrelated jobs can be omitted. Collect p50/p95 wall time, aggregate job time, setup/test/remap breakdowns, cache hits, and flaky reruns across a sample before choosing shard counts. Preserve process isolation for GTK/native suites. See [BT-03](./build-test-rust.md) and [raw job timing evidence](./evidence.json).

## Remaining backlog

| Timing | Work | References | Size |
| --- | --- | --- | --- |
| October, first | Fix the five P1 verification gaps, or start the larger artifact-acceptance work while closing the small configuration gaps. | NX-1, NX-2, CI-01–03 | Small to medium each |
| October | Implement real website typechecking/Vue linting and assertion-policy linting; enforce locked Cargo builds. | Q1, Q2, BT-01 | Small to medium |
| October | Trial affected planning; reduce unrelated task prerequisites; fix local runtime fingerprints. | NX-3–5 | Medium |
| October–November | Add workflow/shell/Docker checks; retain failed-shard diagnostics; define the Cargo dependency policy and package-age exceptions. | CI-08, BT-02, BT-04, Q3 | Small to medium |
| November | Establish image freshness/digests/download verification; serialize and monotonically promote npm channels; align repository settings/runbook. | CI-04, CI-06, CI-07, CI-10 | Medium |
| November | Validate ordinary fork contributions and the initial Dependabot image-refresh path; confirm npm-side publishing and Nx Cloud permissions. | CI-09, CI-05, external checks below | Small to medium |
| November | Tune shard/setup overhead using measurements; configure a production/strict Knip pilot and direct declaration dependency review. | BT-03, NX-7, Q4, Q5 | Medium |
| Before the release candidate | Verify the minimum runtime/native support contract, performance trend, exact release artifacts, full coverage and publication retry behavior. | CI-03, BT-05, CI-06 | Medium |
| After evidence justifies it | Tighten stale lint suppression handling/local dependency verification; follow Vite's future API transition. | Q6, Q7, BT-06 | Small or medium |

Sizes are rough engineering scope, not time commitments. NX-6 duplicates Q3; NX-8 duplicates Q7. They are one action each, not separate findings. CI-05 is an unresolved operational validation question, not a confirmed Dependabot permission failure: current GitHub documentation permits explicit scope increases and the image jobs request `packages: write`.

## Research references and reusable OSS patterns

Each domain report links the relevant current official documentation next to its recommendations. OSS references are pinned to inspected revisions where possible; borrow specific patterns, not entire configurations.

| Project | Pattern examined | GTKX application |
| --- | --- | --- |
| [Nx CI](https://github.com/nrwl/nx/blob/b94bedeed454577ed311543d32395cc417056d6d/.github/workflows/ci.yml) | Full history, SHA selection, affected execution, separate global checks | Base/head planning and selective jobs without losing workspace checks. |
| [Twenty affected action](https://github.com/twentyhq/twenty/blob/741d216a75af0939d7ee8edf91b3ff16f61abda5/.github/actions/nx-affected/action.yaml) | Centralized affected invocation | Fits existing GTKX container composites; retain GTKX's own recovery semantics. |
| [typescript-eslint configuration](https://github.com/typescript-eslint/typescript-eslint/blob/3728e1bd6a67892c7a127057eb6910b4b67ee119/eslint.config.mjs) and [Knip](https://github.com/typescript-eslint/typescript-eslint/blob/3728e1bd6a67892c7a127057eb6910b4b67ee119/knip.ts) | Typed project service, stale suppression errors, explicit workspace entries | Preserve current typed rules and make missing coverage explicit. |
| [Vite CI](https://github.com/vitejs/vite/blob/bc598a6a8a6b7d6e157e9f19c16911cff8d2360c/.github/workflows/ci.yml) | Runtime compatibility and distinct dev/build integration | Test GTKX's declared runtime/native support contract with a small consumer matrix. |
| [Vitest CI](https://github.com/vitest-dev/vitest/blob/7d8ed3e9b70f23eb9c05b3693f19c528799d78cc/.github/workflows/ci.yml) | Structured reports on failed runs, targeted handling of heavy suites | Better failure diagnostics and measured shard balancing. |
| [NAPI-RS ASAN](https://github.com/napi-rs/napi-rs/blob/afbe5dfcf14cb5d0114aa44e07dd454e7b808886/.github/workflows/asan.yml) | Native checks through Node execution | Supports retaining GTKX's real native canaries; preserve GTKX leak detection. |
| [Official Node container build](https://github.com/nodejs/docker-node/blob/766ca4f1bbe23ad677622808b0131b4e51f7fc01/24/bookworm/Dockerfile) | Signed checksum verification before extraction | Verify downloaded Node toolchains in the GTKX CI image. |

## What was verified

- Read all relevant root/package configuration, seven workflows, eight composite actions, Dockerfile, native manifest/toolchain, release scripts, and contributor runbooks.
- Resolved the Nx project graph and task plans without executing tasks; reproduced affected selection for a fixture and a representative package source change. Independently cross-checked both high-priority Nx findings.
- Ran default Knip successfully. Ran strict Knip diagnostically; its configuration-dependent output requires triage and was not treated as a defect count.
- Ran plain website `tsc` successfully, while separately establishing that the Nx target is a no-op and `.vue` files are lint-ignored. Plain `tsc` does not validate SFC templates.
- Used ESLint's public API for in-memory policy probes and TypeScript's API for configuration membership. The membership scan covered 81 configs and 1,671 included root files, with no uncovered tracked TS-family files outside intentional fixtures/tutorial exclusions; it is not proof that every target executes.
- Inspected Cargo metadata using `--locked --offline --no-deps`; did not claim this was a native build.
- Read live GitHub rulesets, Actions settings, environments, release immutability, successful CI/release metadata, and the public Sonar gate. Selected evidence is preserved in [evidence.json](./evidence.json).

No full monorepo build/test run, package installation, browser/UI inspection, container operation, production publication, external mutation, or cache-corruption experiment was performed. No source implementation changed, so new unit tests were neither needed nor added. The unavailable local pnpm shim was bypassed with installed tool executables under `mise exec --`; the environment was left unchanged.

Still to verify outside this audit: npm package-side trusted-publisher bindings and token/2FA policy; Nx Cloud credential scopes; actual oldest-supported native ABI compatibility; clean-cache artifact restoration; reproducible build hashes; fork/initial-bot workflow outcomes; and representative flake/cache/performance statistics. Any workstation tooling changes should be recorded in its Ansible repository.

## Detailed reports

- [Nx, affected execution, task graphs, caching, and pnpm](./nx.md)
- [GitHub Actions, Docker, publishing, repository policy, and SDLC](./ci-release.md)
- [Knip, ESLint, TypeScript, and dependency hygiene](./quality.md)
- [Vite, Vitest, Cargo, native validation, and performance](./build-test-rust.md)
- [Selected machine-readable evidence](./evidence.json)
