# Vite, Vitest, Cargo, and validation strategy

Snapshot: 2026-09-27, GTKX `c43a7ff610773879b0115e5bd6be60c1638c9702`. Inspected installed Vite 8.3.0, Vitest and V8 coverage 5.0.1, Cargo 1.98.1, the pinned nightly, test configuration, build plugins, and recent CI job metadata. This is a configuration and SDLC audit, not a new execution of the complete application suite.

## Findings and recommendations

### BT-01 — P2: Native CI builds do not enforce the committed Cargo lockfile

Evidence: `packages/native/package.json:69` invokes `napi build` without forwarding `--locked`; `:71` invokes Clippy without `--locked`. `scripts/asan-native.ts:14` constructs another build command with the same omission, used for the sanitizer build and restoration. The installed NAPI CLI forwards extra Cargo options and initializes them to an empty list; it does not supply this safeguard implicitly.

Impact: Cargo can update dependency resolution when a manifest and its lockfile diverge. CI can therefore validate or publish a dependency set different from the reviewed lockfile. Having Cargo.lock committed is good, but does not by itself make an inconsistent lockfile fail. This audit did not find an actual lockfile mismatch.

Recommendation: Forward `--locked` to Cargo from every native build entrypoint, including sanitizer/restoration and release builds, and add it to Clippy. Reserve dependency resolution changes for explicit update work. Use `--frozen` only when the dependency-download phase has already completed; it also prevents network access. These semantics are documented in the [Cargo build reference](https://doc.rust-lang.org/cargo/commands/cargo-build.html).

Validation performed: `mise exec -- cargo metadata --manifest-path packages/native/Cargo.toml --locked --offline --no-deps --format-version=1` succeeded. This confirms metadata can be inspected under those constraints, not that a complete native build succeeds offline. Acceptance: the normal native pipeline passes with its committed lockfile; in an isolated checkout, a deliberately inconsistent manifest/lockfile fails without modifying the lockfile. Confidence: high. Effort: small.

### BT-02 — P2: Failed test shards do not retain their structured diagnostic artifacts

Evidence: `package.json:121` emits a Vitest blob report for coverage shards, but `.github/workflows/ci.yml:411`, `:447`, and `:542` upload only under the default success condition and retain artifacts for one day. `ci.yml:231` merges coverage only after all coverage groups succeed. Normal CLI/MCP test shards have no equivalent persistent structured result. Console logs still exist; this is not a claim that failures are unobservable.

Impact: The most useful per-file timings/results disappear from the artifact path when a shard fails, and late investigations or partial workflow retries quickly lose the original successful shard artifacts. Long native/subprocess integration runs are harder to compare across failures.

Recommendation: Separate diagnostics from the passing coverage gate. Upload any available blob/JUnit report and selected native/CLI failure artifacts when the job fails as well as when it passes, using an appropriate cancellation condition and a modest retention window such as 7–14 days. Do not let missing optional diagnostic files obscure the original failure. Keep complete-shard requirements for authoritative coverage; a partial diagnostic merge must never become a passing coverage gate. Avoid wholesale environment/core-dump uploads that may contain credentials.

The [Vitest sharding guide](https://vitest.dev/guide/improving-performance.html#sharding) describes blob aggregation. [Vitest's own CI](https://github.com/vitest-dev/vitest/blob/7d8ed3e9b70f23eb9c05b3693f19c528799d78cc/.github/workflows/ci.yml) retains results on unsuccessful, non-cancelled runs and publishes a merged report. Adopt the reporting pattern, not its entire suite or runtime matrix.

Acceptance: a controlled failing integration case produces a failed required check and a downloadable diagnostic report; a passing run still merges every expected shard. Confidence: high. Effort: small to medium.

### BT-03 — P2 optimization: Measure shard balance and repeated setup before adding parallelism

Evidence: `.github/workflows/ci.yml:490` fixes CLI coverage/test partitioning at 23 shards. Each starts the shared install/build prerequisite path; coverage shards run an uncached root target (`package.json:121`). The shared worker heuristic is CPU/4 (`vitest.config.base.ts:5`), with job overrides of one to three workers. CLI test and hook timeouts are ten minutes (`packages/cli/vitest.config.ts:11`). Those choices may be justified by real native integration costs; neither timeout nor shard count is itself a defect.

Measured baseline: [successful PR #764 CI](https://github.com/gtkx-org/gtkx/actions/runs/36329827600) ran from 15:30:49 to 15:50:36 UTC on 2026-09-27. GitHub returned 52 job records, including four skipped records. Summing successful jobs' start/end durations gives about 406.4 job-minutes. This is aggregate elapsed job time, not a bill or a statistically representative estimate.

| Group | Jobs | Aggregate job-minutes | Shortest | Median | Longest |
| --- | ---: | ---: | ---: | ---: | ---: |
| CLI coverage | 23 | 272.0 | 7m51s | 11m03s | 16m58s |
| MCP coverage | 3 | 31.4 | 9m58s | 10m14s | 11m14s |
| Other coverage | 4 | 34.1 | 8m01s | 8m13s | 9m37s |
| ASAN | 2 | 21.1 | 8m58s | — | 12m09s |

Recommendation: First fix Nx graph/hash correctness and scope prerequisites; then measure queue, image pull, install, codegen/build, test execution, and coverage remapping separately over a representative sample. Compare affected versus full verification. Use per-file timings to split long integration scenarios or balance shards; compare worker counts under the same memory/CPU budget. Select optimizations using both wall time and aggregate job time. Vitest shards files, so increasing the shard count does not subdivide an individual slow file.

Keep process isolation for GTK/native suites unless behavior-driven validation proves a change safe. Compositors, D-Bus sessions, native libraries, and GC make generic advice to disable isolation or switch all tests to worker threads inappropriate here. The [Vitest performance guide](https://vitest.dev/guide/improving-performance.html) recommends profiling first; its own workflow separately handles a dominant browser spec, illustrating targeted balancing.

Acceptance: record a before/after sample, cache-hit rate, p50/p95 wall time, aggregate job time, longest shard, and flake rate. No speedup percentage is established by this audit. Confidence: high on measurements, medium on proposed savings until benchmarked. Effort: medium.

### BT-04 — P2 hardening: Give native dependency advisories and licenses an explicit policy

Evidence: Dependabot updates Cargo and CodeQL analyzes Rust, but no Cargo advisory/license policy or `cargo audit`/`cargo deny` target is present. `packages/native/Cargo.lock` records the shipped native dependency graph. Source analysis and automated update PRs are useful but do not constitute an explicit RustSec/license acceptance policy.

Recommendation: Select one suitable native dependency check. `cargo deny` can cover advisories, licenses, source registries, and duplicate/dependency policy; use `cargo audit` if only RustSec advisory checking is wanted. Run against the committed lockfile on dependency PRs, periodically for newly published advisories, and before release. Pin the tool and define narrowly reviewed exceptions. Record any local tool/environment change in the workstation Ansible repository. Do not add both tools merely to duplicate checks, and do not begin with an unexplained blanket license deny list.

This is a proposed control, not a finding of a vulnerable crate or unacceptable license. [cargo-deny's maintained documentation/source](https://github.com/EmbarkStudios/cargo-deny) describes the available checks. Acceptance: the chosen policy produces an actionable report for the actual locked dependencies and is documented with owners for exceptions. Confidence: high for absence, policy choice for scope. Effort: small to medium.

### BT-05 — P3: Schedule the existing performance suite and track the release compatibility contract

Evidence: `packages/e2e/package.json:57`, `package.json:88`, and `:121` exclude `query-perf.test.tsx`; `website/contributing/testing.md:59` documents an intentional manual run. No scheduled performance job exists. The standard CI image pins Node 26.8.2 while packages declare a floor of 26.7.0. Platform acceptance gaps are covered separately in CI-03.

Recommendation: Give the existing user-facing query performance suite a deliberate periodic and release-candidate lane with a stable machine/image and stored results. Prefer trend review or a calibrated regression threshold over a brittle timing assertion on every PR. Include a small installed-consumer smoke run at the declared minimum Node version, alongside the normal current version, when release compatibility is verified. Do not expand every native suite into a Cartesian product of every runtime and distro.

The actual [Vite CI](https://github.com/vitejs/vite/blob/bc598a6a8a6b7d6e157e9f19c16911cff8d2360c/.github/workflows/ci.yml) distinguishes the runtime used to build from the runtimes used to execute tests. This is a useful compatibility pattern; GTKX's smaller documented support contract should determine its own matrix.

Acceptance: release review has recent performance evidence and a passing minimum-runtime installed-consumer result. No existing runtime incompatibility or performance regression was demonstrated. Confidence: high for current lane coverage, policy choice for frequency. Effort: small to medium.

### BT-06 — P3 migration watch: Prepare for Vite's environment APIs without forcing a release rewrite

Evidence: `packages/cli/src/internal/module-loads.ts:30`, `packages/cli/src/dev/runner.ts:154`, and `packages/cli/src/storybook/session.ts:51` call `ssrLoadModule`; `packages/cli/src/vite-plugins/settings.ts:309` uses `handleHotUpdate`. Other plugins already use the newer `hotUpdate` and hook filters. Vite plans `ssrLoadModule` deprecation for a future major; this is not a current incompatibility or an announced removal date. Its [HMR transition guidance](https://vite.dev/changes/hotupdate-hook) currently recommends retaining `handleHotUpdate`.

Recommendation: Track the ModuleRunner/environment transition as a bounded compatibility task. Exercise opt-in future warnings in a canary lane, retain a module-loading abstraction, and migrate through real `gtkx dev`, hot-reload, Storybook, and shutdown integration scenarios. Avoid changing all plugin lifetime/state handling immediately before 2.0 solely to use newer API names.

Sources: [Vite's planned ModuleRunner transition](https://vite.dev/changes/ssr-using-modulerunner), [environment APIs for plugins](https://vite.dev/guide/api-environment-plugins). Acceptance: no regression in startup, reload isolation, configuration changes, module failure recovery, or process cleanup against supported Vite versions. Confidence: high; future maintenance, not a release blocker. Effort: medium.

## Strong practices to retain

- Vite usage is already modern: Rolldown output configuration, explicit native externalization, middleware mode for the custom desktop host, hook filters for virtual modules, lazy loading of the Babel compiler, and source maps from transformations. These align with [Vite's plugin API](https://vite.dev/guide/api-plugin) and [performance guidance](https://vite.dev/guide/performance). Browser dependency prebundling advice does not automatically apply to this native SSR-style environment.
- Shared Vitest projects, explicit source resolution, V8 coverage, blob reports, separated coverage groups, and subprocess c8 reporting address genuine monorepo/native requirements. V8 is an appropriate default under the [Vitest coverage guidance](https://vitest.dev/guide/coverage.html).
- The suite exercises actual GTK widgets, headless displays, generated native bindings, CLI processes, installation, and packaging. Source inspection found 507 package test files and no `vi.mock` or `vi.spyOn` calls in the searched `.test.ts`/`.test.tsx` files. That is useful evidence of low mocking, not a certified 90% integration/E2E ratio or an assertion that every subject has happy/edge/error coverage.
- Native tests use a fixed GNOME fixture revision, heap checks, explicit GC, and ASAN/LSAN with pinned nightly tooling. [NAPI-RS's own ASAN workflow](https://github.com/napi-rs/napi-rs/blob/afbe5dfcf14cb5d0114aa44e07dd454e7b808886/.github/workflows/asan.yml) supports the value of testing through Node/native integration. GTKX additionally enables leak detection; copying upstream's leak setting would weaken the existing check.
- Rust 2024, a pinned stable toolchain, committed Cargo.lock, Clippy pedantic checks, formatting checks, and denied Clippy warnings are sound. The native crate is a Node addon; adding a conventional Rust unit suite merely to tick a box would conflict with the repository's behavior-first test policy.
- Cargo registry/git caches are safely separate from Nx final artifacts. A compiled Cargo cache could improve cold/repeated sanitizer compilation, but should be considered only after native cache keys are fixed and timings justify it. Hash toolchain, architecture, image and relevant flags; do not broadly share a target directory across incompatible environments. The [Cargo home guidance](https://doc.rust-lang.org/cargo/guide/cargo-home.html) also explains how to avoid duplicate downloaded/source caches.
- Root Vitest has no blanket coverage threshold, but the actual required Sonar gate enforces new-code coverage of at least 80%. It was inspected and passing at 86.7%. Adding a second arbitrary global coverage gate is not a finding or an automatic improvement.

## Validation limits

No package installation, full build, test-suite execution, Docker/Podman operation, native binary analysis, publish, settings change, or offensive reproduction was performed. Recommendations that involve failing inputs refer to future local/integration acceptance checks, not experiments executed against external infrastructure. Existing environment/tool versions and API snapshots were inspected; minimum-system ABI compatibility, flaky-test rate, reproducible artifact bytes, and coverage completeness were not independently measured.
