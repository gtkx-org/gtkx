Nx and pnpm audit, 2026-09-27

Repository: `/home/eugenio/gtkx`, HEAD `c43a7ff610773879b0115e5bd6be60c1638c9702`. Read-only inspection of tracked files; generated inspection artifacts are under `/tmp`. No builds, test suites, installations, cache cleaning, or remote changes were performed. Nx graph inspection may update its ignored workspace metadata. Tracked working tree was clean after inspection.

Installed configuration uses Nx / @nx plugins 23.2.1, pnpm 12.4.2, Node 26.8.2, TypeScript 6.0.3, and Vitest 5.0.1. Current Nx v23 and pnpm v12 documentation was consulted. The `...` inputs merge syntax is supported and its behavior was verified in the resolved graph; it is not an error.

The two release-blocking issues in this portion of the audit are native cache identity and test-fixture ownership. Fix these before reducing CI selection with affected. The largest optimization is affected selection plus narrower prerequisite graphs; changing only the CLI command leaves substantial redundant work.

| ID | Priority | Category | Finding | Confidence |
| --- | --- | --- | --- | --- |
| NX-1 | P1 | Correctness | Native build and Rust lint ignore the CI image/toolchain environment in their cache inputs | High; resolved task plan inspected |
| NX-2 | P1 | Correctness | Three CLI fixtures are separate projects, so fixture-only edits do not affect CLI tests | High; affected selection reproduced |
| NX-3 | P2 | Efficiency | CI uses broad run-many commands and static shard matrices, never affected for validation | High; workflow inspection and affected probes |
| NX-4 | P2 | Efficiency | Global test prerequisites build nearly the entire library even for ESLint tests | High; 23-task graph inspected |
| NX-5 | P2 | Correctness/local DX | Runtime-sensitive cache inputs rely on environment variables absent in normal mise execution | High for missing identity, medium for practical stale-hit frequency |
| NX-6 | P2 | Supply-chain hardening | minimumReleaseAge: 0 explicitly disables pnpm's package-age protection | High; policy choice, not proof of compromise |
| NX-7 | P3 | Efficiency | Uncached generators and forced postinstall bootstrap impose a recurring floor | High for configuration, savings require measurement |
| NX-8 | P3 | Local DX | Dependency-state verification is disabled globally | High; intentional exceptions may exist |

1. **NX-1: native cache identity omits the environment that produces the binary.**

   Evidence: `packages/native/package.json:76-86` defines `crate` from Rust source, build.rs, Cargo manifests/lockfile, package.json, rust-toolchain.toml, and `uname -m`. The native build replaces all inherited inputs with `crate` at `packages/native/package.json:95-105`; Rust lint uses the same set plus formatting/script files at `:107-115`. `nx.json:27` defines the intended `CI_IMAGE_ID` input in sharedGlobals, but these targets do not include it. `.github/actions/compute-cache-env/action.yml:7-12` exports the immutable image ID, and `.github/actions/run-in-container/action.yml:54-62` forwards it.

   The generated native task plan in `/tmp/gtkx-audit-eslint-taskgraph.json` includes only these relevant identity instructions: `runtime:uname -m`, `workspace:[{workspaceRoot}/rust-toolchain.toml]`, and `env:NX_CLOUD_ENCRYPTION_KEY`. It has no CI_IMAGE_ID, RUSTUP_TOOLCHAIN, RUSTFLAGS, CARGO_ENCODED_RUSTFLAGS, system-library, compiler, or libc identity. `AllExternalDependencies` is present automatically, so JavaScript lockfile changes are conservatively covered; do not report those as missing inputs.

   Impact: changing the CI image's system libraries/compiler, or using a local environment of the same architecture, can replay a previously cached `.node` binary. Rust lint can similarly replay success instead of rerunning after a relevant environment change. Rust-toolchain.toml handles the declared Rust version but does not identify a toolchain override or native system SDK. A different image does invalidate most JavaScript tasks, making the native omission especially inconsistent.

   Remediation: introduce a native-environment named input that includes CI_IMAGE_ID, relevant compile/target/toolchain override variables, and a deterministic local fallback fingerprint for the actual Rust/compiler/system libraries. Reuse it for native build and Rust lint. Scope native build external tool dependencies after correctness is restored, since AllExternalDependencies currently invalidates the Rust task for unrelated npm updates.

   Validation: inspect the resolved task plan for the new identity inputs; in an isolated workspace, warm the build cache, then change only the image identity/toolchain flags and confirm a miss. Confirm an unchanged environment hits, architecture changes miss, and the restored addon loads in its target environment. This is a cache integration check, not a new unit-test suite.

   Important limitation: `scripts/asan-native.ts:35-62` calls pnpm/napi directly with sanitizer flags, then rebuilds normally in `finally`. The current sanitizer build does not run through native:build. This finding does not claim ASAN artifacts are currently uploaded to the normal Nx native-build cache.

2. **NX-2: fixture packages escape their parent project's affected calculation and cache inputs.**

   Evidence: `nx.json:55-66` excludes only ESLint fixtures from the TypeScript/ESLint plugins. `packages/cli/tests/fixtures/configured-props/@audit/element-props/package.json:1-11` and its two sibling manifests are discovered as standalone projects. The resolved graph has 34 projects, including `@audit/element-props`, `@audit/element-base`, and `@audit/union-props`; all have inferred lint targets and zero incoming dependency edges. CLI tests actually consume these directories by filesystem copy in `packages/cli/tests/configured-props-fixture.ts:19` and `:59-60`.

   Reproduced without changing a file:

   `NX_DAEMON=false mise exec -- ./node_modules/.bin/nx show projects --affected --files=packages/cli/tests/fixtures/configured-props/@audit/element-props/index.d.ts --json`

   Result: `["@audit/element-props","gtkx"]`. `@gtkx/cli` is absent. The CLI test task plan uses project-scoped `packages/cli/**/*` plus dependency inputs and has no @audit dependency. Nx explicitly excludes nested-project files from projectRoot globs. Root workspace-glob checks still see the file, but they do not run the CLI test suite.

   Impact: a fixture-only change can reuse the CLI test cache today. An affected rollout would additionally omit CLI test scheduling. Extra fixture lint projects also pollute orchestration.

   Remediation: exclude CLI fixture manifests from plugin project discovery, just as ESLint fixtures are excluded, so the parent CLI project owns those files. Verify the final graph, because package discovery can come from multiple plugins. Alternatively explicitly include these fixture files in the parent target's workspace-root inputs and model the dependencies, but separate fake package projects are unnecessary here. Do not solve this by putting fixtures in .nxignore: that hides them from affected and hashing entirely.

   Validation: after correction the three @audit projects should disappear; repeating the affected probe must include @gtkx/cli. An isolated cache replay check should confirm a meaningful fixture edit reruns the existing configured-props integration suite, and an unrelated fixture outside CLI does not trigger it.

3. **NX-3: adopt affected only after graph correctness checks, and apply it before starting jobs.**

   Evidence: `package.json:13,20,22` invokes run-many for lint, test, and typecheck. `.github/workflows/ci.yml:277-316,327-371,611-624` invokes all of those or static per-project test/shard jobs. The only NX_BASE/NX_HEAD use is release-plan checking at `:634-667`; most validation checkouts retain shallow defaults. Coverage grouping is a coarse file filter at `:47-74`, not the project dependency graph.

   A representative source probe, `nx show projects --affected --files=packages/forms/src/index.ts --json`, selected only `@gtkx/forms`, `@gtkx/website`, and `gtkx`: 3 of the current 34 projects. A website/index.md probe selected website and gtkx. These are selection observations, not predictions of proportional runtime savings; prerequisites and whole-workspace checks remain.

   Remediation: calculate a trustworthy base/head once, give validation jobs enough Git history, and forward NX_BASE and NX_HEAD explicitly through the container helper. Use `nx affected -t lint typecheck test` for compatible checks; Nx's normal syntax is the `affected` subcommand. A matrix-planning step can query `nx show projects --affected --with-target=test --json` and create only needed expensive CLI/MCP/sanitizer job groups. Keep whole-workspace Knip, release-consumer, full coverage, and release validation where their contracts require it; do not silently turn a full coverage report into partial coverage. Decide whether PR coverage is incremental with a separate complete baseline, or remains deliberately complete.

   Use the last successful main run as base, rather than always HEAD~1: canceled or failed main runs must not cause earlier changes to disappear. Maintain distinct review base/head values for the release-plan check; do not replace that policy mechanically with the CI-recovery base. Start with conservative all-project handling of lockfile changes. Consider `projectsAffectedByDependencyUpdates: auto` only after dependency-change scenarios are validated.

   Validation: run selection planning side by side with today's full CI for representative source, fixture, shared config, lockfile, native, docs, and workflow changes. Cover canceled/failed-main recovery, a PR merge commit, fork PRs, an empty affected set, and manual/release events. Compare end-to-end duration, aggregate job-minutes, cache hit rates, and required-check behavior. The parent audit has a real 52-job baseline; no percentage savings are claimed here.

   Official basis: [Nx affected](https://nx.dev/docs/features/ci-features/affected) documents graph-aware selection, last-successful-main base selection, history requirements, and conservative lockfile behavior. [Nx CI setup](https://nx.dev/docs/getting-started/setup-ci) provides the matching workflow pattern.

4. **NX-4: global task prerequisites defeat project-level isolation.**

   Evidence: `nx.json:138-151` makes every inferred test depend on ten named package builds plus root codegen. `nx.json:86-104` also attaches root codegen to every TypeScript build/typecheck. Even the internal ESLint package, whose `packages/eslint/vitest.config.ts:1-12` uses ordinary source resolution rather than the native Gtkx test environment, inherits this fan-out.

   `NX_DAEMON=false mise exec -- ./node_modules/.bin/nx run @gtkx/eslint:test --graph=/tmp/gtkx-audit-eslint-taskgraph.json` produces 23 tasks: its test, 19 builds including the native addon, root codegen, GL codegen, and template copying. The test's hash plan additionally includes the JS outputs of these unrelated prerequisite builds. No task was executed for this measurement.

   Impact: a narrow check requires a GTK/native toolchain, pays scheduling/restore/generation overhead, and loses cache reuse when unrelated built JavaScript changes. This particularly hurts local work and fork PRs with limited remote-cache access. Affected by itself still expands into this prerequisite graph.

   Remediation: define dependencies at the package or test-family level; pure ESLint/config/codegen checks should have their actual requirements. Retain explicit CLI/build prerequisites for integration tests that spawn the built CLI or inspect packaged output. Use project-graph dependency builds where correct, and smaller named setup targets when multiple suites share requirements. Do not replace the list wholesale with ^build without validating generated bindings and subprocess behavior.

   Validation: compare task graphs for ESLint, one native integration package, and CLI integration tests. Execute the existing suites from clean isolated checkouts to establish that all necessary prerequisites remain. Use Nx profiling and CI timing to measure the effect.

   Official basis: [Nx task pipelines](https://nx.dev/docs/concepts/task-pipeline-configuration) describes project-specific task dependencies and graph scheduling.

5. **NX-5: environment names are not a reliable local runtime fingerprint.**

   Evidence: `nx.json:19-40` includes CI_IMAGE_ID, ADWAITA_VERSION, GTK4_VERSION, GTKX_GIR_PATH, and NODE_VERSION as environment inputs. `mise.toml:1-3` selects Node but does not export NODE_VERSION. A read-only `mise exec -- node` inspection found all five variables unset in this development environment. None of the shared inputs runs node --version or fingerprints installed GIR/GTK libraries.

   Impact: changing the actual local Node runtime or installed GTK/GIR libraries can leave the relevant cache identity unchanged. The immutable CI image ID protects most CI tasks, but does not protect local cached test/lint results. Several generated-type builds also hash dependency outputs, which partially mitigates generator changes; do not assume every target is affected equally.

   Remediation: hash actual Node version with a runtime input, and create a stable native/GIR environment fingerprint appropriate to Fedora development and containerized CI. Hash only what the target consumes. Keep the image ID for CI; do not replace it with mutable image tags. Document the toolchain contract in the environment's workstation Ansible roles as required by repository instructions.

   Validation: verify that switching the actual runtime/system-library fingerprint changes task hashes with source files untouched, while unrelated environment variables do not. Pin reproducible development tool versions through the existing environment mechanism.

   Official basis for NX-1, NX-2, and NX-5: [Nx input reference](https://nx.dev/docs/reference/inputs) specifies project-root exclusion of nested projects, runtime/environment inputs, and dependent-output inputs. The detailed conclusions above are based on local task plans and graph probes.

6. **NX-6: review the deliberate removal of dependency cooldown.**

   Evidence: `pnpm-workspace.yaml:9` sets minimumReleaseAge to zero. The project otherwise has useful safeguards: trustPolicy no-downgrade at `:10`, two exact-version trust exceptions at `:17-19`, explicit allowBuilds at `:34-37`, integrity-bearing packageManager at `package.json:223`, and frozen lockfile installs in `.github/actions/run-in-container/action.yml:73`.

   Impact: new external releases can enter the graph immediately. A frozen lockfile controls reproducibility but does not provide a waiting period for newly introduced versions. This is a hardening gap relative to the current pnpm default, not evidence of any vulnerable dependency.

   Remediation: adopt an explicit cooldown, for example 1440 minutes, with narrow exceptions for packages that need immediate release-consumer testing. The local-registry publish/consumer checks may need scoped @gtkx exceptions or a separate test-registry configuration; do not disable the policy for every external package to support those tests. Keep trust-policy exceptions version-specific and review/prune them during upgrades.

   Validation: use a controlled registry fixture or isolated install environment to check an eligible mature dependency, an intentionally allowed first-party release, and a too-new external dependency; assert success/failure only. Confirm frozen lockfile installs and the consumer release suite remain usable.

   Official basis: [pnpm dependency resolution](https://pnpm.io/settings/dependency-resolution) documents the 1440-minute default since v11, strict explicitly configured cooldowns, exceptions, and no-downgrade trust behavior. Avoid adopting options introduced after the pinned 12.4.2 without a deliberate upgrade.

7. **NX-7: measure and reduce uncached setup costs.**

   Evidence: `package.json:15` forces a TypeScript build of the Vitest bootstrap on every install, outside Nx caching. Root codegen/reference targets are uncached at `:28-46`; example/e2e codegen is also uncached. Website build is uncached at `website/package.json:47-62`. Each CI job installs through the container helper; every task family depending on codegen runs it again on that machine even when downstream tasks hit the cache.

   These choices may be correct: generated package resolution and reference output can depend on installed GIR data, symlinks, workspace location, or external documentation pins. Do not simply set cache true. First measure bootstrap/generator time and split deterministic generated artifacts from installation/linking or environment-sensitive work. Make the deterministic portion cacheable with complete inputs and outputs, or let an existing incremental generator handle no-op work. Consider whether --force remains necessary for every installation; preserve whatever bootstrap is required for Nx/Vitest to load project config.

   Validation: use fresh checkouts with a warm remote cache and confirm generated bindings resolve, symlinks and metadata exist, and CLI/typecheck/tests pass after restoration. Compare cold and warm bootstrap time, and test a GIR version change. Keep release/publish and other side-effecting targets uncached.

8. **NX-8: dependency-state verification has been disabled for every local command.**

   Evidence: `pnpm-workspace.yaml:12` sets verifyDepsBeforeRun to false. Frozen lockfile CI installs already establish a consistent CI tree, but a developer switching branches may execute with stale node_modules without a pnpm check. Some release/test-registry scripts intentionally alter manifests and may explain the setting.

   Remediation: audit that rationale, then consider warn or error for normal developer commands, with scoped exceptions around intentional temporary manifest changes. Prefer a deterministic failure over automatic installation during an audited task when correctness matters. This is lower priority than the concrete cache and graph defects.

   Validation: in an isolated checkout, change manifests without installing and verify the selected policy catches stale dependencies; rerun the release-consumer workflow to check intentional transitions.

   Official basis: [pnpm build settings](https://pnpm.io/settings/build) documents install/warn/error/prompt/false modes and the current explicit build-script allowlist mechanism.

Practices already aligned with modern Nx/pnpm use:

- Inferred TypeScript, ESLint, and Vitest targets rather than duplicate per-project commands; Nx and official plugins are aligned at the same version.
- The TypeScript inferred build outputs and generated dependency declarations are preserved by `...` inputs; GL build adds generated TypeScript output hashing at `packages/gl/package.json:89-93`.
- Shared environment/config inputs and an immutable image ID are a strong starting point, subject to NX-1/NX-5.
- Native outputs explicitly include the addon binary and generated declarations. Native source, Cargo.lock, declared Rust toolchain, and architecture are already covered.
- Side-effecting release tasks are uncached and serialized at `nx.json:153-159`.
- Workspace protocol dependencies and catalogs reduce dependency drift; packageManager pins pnpm with integrity; CI installs use --frozen-lockfile.
- CI uses different Nx Cloud credentials for main and PRs (`.github/workflows/ci.yml:24`), matching [Nx access-token guidance](https://nx.dev/docs/kb/access-tokens). Actual permissions are an external setting to verify. Absence of nxCloudId alone does not establish a broken connection, because CI access-token environment configuration is supported.
- `.nxignore:1` excludes the intentionally separate tutorial consumer; dedicated tutorial CI provides coverage for that deliberate boundary.

Exemplary OSS comparison, patterns rather than templates to copy wholesale:

- [Nx's own CI](https://github.com/nrwl/nx/blob/b94bedeed454577ed311543d32395cc417056d6d/.github/workflows/ci.yml) combines full-history checkout, nx-set-shas, affected tasks, separate workspace checks, frozen pnpm installs, and an explicit pnpm store path. This is a useful reference for integrating affected while retaining global validation. Its distributed agents and platform matrix reflect its own scale and are not automatically requirements for GTKX.
- [Twenty's nx-affected composite](https://github.com/twentyhq/twenty/blob/741d216a75af0939d7ee8edf91b3ff16f61abda5/.github/actions/nx-affected/action.yaml) centralizes affected invocation and exposes task/parallelism selection. That composition pattern maps well to GTKX's existing container composites. Its exact base fallback/history choices should be assessed against GTKX's canceled-run and PR policies rather than copied blindly.

Suggested sequencing before December:

1. Correct native/environment hashing and fixture ownership; add cache/selection integration verification using existing suites.
2. Establish affected base/head planning and compare it with full validation before making it authoritative. Preserve a full release/scheduled validation lane.
3. Narrow prerequisite graphs, then let affected planning reduce expensive test-job creation. Keep coverage semantics explicit.
4. Measure cold/warm setup, tune postinstall/codegen only with restoration evidence, and set a package-age policy compatible with first-party consumer testing.

Artifacts available for independent review:

- `/tmp/gtkx-audit-nx-graph.json`: resolved 34-project graph and targets.
- `/tmp/gtkx-audit-eslint-taskgraph.json`: 23-task ESLint test graph and hash-input plans.
- `/tmp/gtkx-audit-cli-taskgraph.json`: CLI test graph and hash-input plans, including absence of fixture-project dependencies.

The audit did not inspect Nx Cloud dashboard permissions or measure cache hits directly, and did not execute the full test/build suite. Runtime savings remain to be measured against CI history. No recommendation depends on unsupported-version assumptions.
