# GTKX quality and dependency tooling audit

Scope: Knip, ESLint, TypeScript and pnpm. Read-only review of `/home/eugenio/gtkx`, 2026-09-27. No tracked files changed; no installs, builds, cleanup, publication, or new tests. Installed versions inspected: TypeScript 6.0.3, ESLint 10.11.0, Knip 6.38.0, Nx 23.2.1; manifest package manager pnpm 12.4.2. Official docs and actual OSS configurations were fetched during the audit. Findings below separate demonstrated gaps from optional hardening and pilots.

## Confirmed gaps

### Q1 — P2: Website type checking is a no-op, and Vue components are excluded from ESLint

Evidence: `website/tsconfig.json:3` sets `nx.addTypecheckTarget: false`; `website/package.json:151` declares a `typecheck` target containing only `dependsOn: [reference]`. The resolved Nx target is `executor: nx:noop`, with no TypeScript command. `packages/eslint/src/index.ts:83` globally ignores `**/*.vue`. The website has 20 Vue SFCs, including the custom navigation/version selector and landing page. `website/package.json:14` builds via `vitepress build`, and no `vue-tsc` is declared.

Impact: The CI typecheck job can report success without checking website component scripts, props or templates. Vite compilation alone is not a type check. This is a coverage gap, not a demonstrated current website failure. [Vue TypeScript documentation](https://vuejs.org/guide/typescript/overview).

Remediation: Give `@gtkx/website:typecheck` an explicit `vue-tsc --noEmit -p website/tsconfig.json` command and cache inputs that cover SFCs/configuration. Add a scoped Vue ESLint configuration and remove the blanket Vue ignore. Preserve the website's browser-oriented compiler environment rather than blindly inheriting the Node-only root environment. The existing website reference dependency can be retained only where its output is actually required by the check.

Validation performed: `NX_DAEMON=false mise exec -- ./node_modules/.bin/nx show project @gtkx/website --json` showed `nx:noop`; ESLint Node API `isPathIgnored('website/.vitepress/theme/Layout.vue')` returned true. `mise exec -- ./node_modules/.bin/tsc --project website/tsconfig.json --noEmit --incremental false` passed, but ordinary `tsc` does not check SFC templates. Validate the change using the actual Nx target and a temporary consumer-facing SFC error in an isolated checkout, then remove the temporary edit.

Confidence: high. Effort: small to medium, depending on existing SFC diagnostics.

### Q2 — P2: The two explicitly prohibited TypeScript assertion forms pass the real lint configuration

Evidence: `packages/eslint/src/index.ts:123` uses `strictTypeChecked`, and `packages/eslint/src/index.ts:141` defines additional source rules, but there are no restrictions for assertions through `unknown` or definite-assignment declarations. The effective config enables `@typescript-eslint/no-non-null-assertion`; this does not cover definite-assignment fields.

Validation performed without editing files: ESLint's `lintText` API, using `filePath: 'packages/utils/src/string/camel-case.ts'` and the unmodified repository config, returned zero messages for both an exported conversion using `value as unknown as number` and an exported class with `value!: string`. The user-supplied repository policy explicitly forbids both forms. This demonstrates missing automated enforcement; it does not establish existing violations in source. A search outside fixtures found no `as unknown as` occurrences.

Remediation: Add precise `no-restricted-syntax` AST selectors for assertions through `unknown` and definite-assignment declarations, keeping the existing non-null expression rule. Extend the existing ESLint configuration integration coverage by linting representative snippets through the public ESLint API; no new unit-test suite is needed. [ESLint no-restricted-syntax](https://eslint.org/docs/latest/rules/no-restricted-syntax), [typescript-eslint no-non-null-assertion](https://typescript-eslint.io/rules/no-non-null-assertion/).

Confidence: high. Effort: small.

## Hardening and design opportunities

### Q3 — P2 hardening: Dependency release-age protection is explicitly disabled

Evidence: `pnpm-workspace.yaml:9` sets `minimumReleaseAge: 0`; `pnpm-workspace.yaml:10` correctly enables `trustPolicy: no-downgrade`; lines 17–19 have narrowly versioned trust exceptions and lines 34–37 explicitly allow three dependency build scripts. The age setting removes a separate safeguard: pnpm's current documentation records a 1440-minute default since v11. Trust history does not cover every compromised fresh release.

Remediation: Set an explicit release age such as 1440 minutes, choosing a longer delay if maintenance cadence permits. Use narrow, reviewed version exceptions for urgent updates or any local-registry release rehearsal that needs them, and verify the Verdaccio/tutorial flow before enabling a gate. This is risk reduction, not evidence that the current lockfile is compromised. [pnpm dependency-resolution settings](https://pnpm.io/settings/dependency-resolution#minimumreleaseage).

Validation: Configuration and current official docs inspected. No dependency resolution/install was performed. A future change should validate both the frozen CI install and the release rehearsal using the pinned pnpm version.

Confidence: high for disabled protection; organizational choice for the delay. Effort: small.

### Q4 — P3 pilot: Add a separately configured production/strict Knip pass

Evidence: `package.json:166` invokes only `knip`. `knip.json` distinguishes many public package entrypoints and marks some production entries with `!`, but lacks production project patterns. `knip.json:152` marks the process-guard runtime entry only for the default analysis. Default analysis includes tests, so test imports can keep otherwise unused production exports alive; strict mode also checks dependency ownership and consumer-facing declaration dependencies. [Knip production and strict modes](https://knip.dev/features/production-mode).

Validation performed: `timeout 90s mise exec -- ./node_modules/.bin/knip --no-progress --reporter compact` passed with no output. The same invocation with `--strict` failed and reported 163 unused files, 2 unused dependencies, 45 unlisted dependency locations, 8 unlisted-binary groups, 16 unused-export locations and 10 unused-type locations. Logs: `/tmp/gtkx-knip-default.log`, `/tmp/gtkx-knip-strict.log`. These counts are the tool's displayed groups/locations, not an independently verified defect count. A large fraction is expected configuration noise from excluded test entries, tooling scripts, optional dependencies and generated/runtime exports. Do not turn this raw result into a required gate or delete the listed files.

Remediation: Pilot production analysis on published workspaces; explicitly model shipped source and dynamic/generated entrypoints, separate tests/tooling, then triage strict dependency ownership. Keep the passing default run. Public entry exports should continue to be exempt where downstream consumers use them. Prefer the existing narrow issue suppressions to blanket ignores. After the pilot is clean, add a distinct Nx target and initially run it periodically or alongside the release consumer checks.

Confidence: high on the missing dimension, intentionally unconfirmed on individual strict findings. Effort: medium.

### Q5 — P3 follow-up: Declare direct React type ownership for packages exposing React types

Evidence: strict Knip flags React imports in declarations from animated/components/forms/navigation/storybook. For example, `packages/animated/package.json:73` lists `react` as a peer but has no direct `@types/react` dependency/peer; `packages/animated/src/types.ts:3` imports React types that appear in public declarations. `packages/eslint/src/index.ts:31` globally exempts `@types/react`, `@types/node` and `@types/ejs` from Nx dependency checks. In contrast, `@gtkx/react` explicitly declares its React type peer.

Impact and limitation: Direct type ownership is less clear than the package's published type API. The packages currently depend on `@gtkx/react`, whose peer can supply React types transitively, and generated consumers also install React types. A consumer failure was not demonstrated; this should not be presented as a broken release.

Remediation: Review public declaration imports and explicitly declare the intended compatible React type dependency/peer in each owning package; tighten the global type-package exception to declarations that are actually development-only. Validate packed packages in an isolated, strict package-manager consumer without repository-root type packages and with `skipLibCheck: false`. [TypeScript publishing dependency guidance](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html#dependencies).

Confidence: high on metadata observation, medium on practical impact. Effort: small to medium.

### Q6 — P3 hygiene: Stale ESLint disable directives are warnings, not CI failures

Evidence: The effective config's `linterOptions.reportUnusedDisableDirectives` is `1` (warn). `packages/eslint/src/index.ts:260` never overrides this; root `package.json:132` and package lint commands use ESLint without `--max-warnings 0`. Consequently stale suppressions need not fail lint.

Remediation: Set `reportUnusedDisableDirectives: 'error'` and consider `reportUnusedInlineConfigs: 'error'`; choose `--max-warnings 0` only if the repository intentionally treats all warnings as blocking. This is maintenance hygiene, not a correctness failure in the currently passing configuration. [ESLint rule configuration](https://eslint.org/docs/latest/use/configure/rules#report-unused-eslint-disable-comments). The actual [typescript-eslint monorepo configuration](https://github.com/typescript-eslint/typescript-eslint/blob/3728e1bd6a67892c7a127057eb6910b4b67ee119/eslint.config.mjs) uses strict type-checked presets, project service, and unused-disable errors.

Confidence: high. Effort: small.

### Q7 — P3 developer-experience option: Fail on stale dependencies before local scripts

Evidence: `pnpm-workspace.yaml:12` sets `verifyDepsBeforeRun: false`, disabling checks before both `pnpm run` and `pnpm exec`. CI's container action performs a frozen install first, so this is primarily a local-workflow concern.

Remediation: Consider `verifyDepsBeforeRun: error` to make stale dependency state explicit without an automatic install. Evaluate the check's overhead for frequent Nx invocations. Do not claim this currently breaks CI. [pnpm build settings](https://pnpm.io/settings/build#verifydepsbeforerun).

Confidence: high for semantics, preference for workflow choice. Effort: small.

## Strong practices to retain

- Shared TypeScript configuration is unusually rigorous: strict checking, exact optional properties, checked indexed access, checked side-effect imports, fallthrough/return/override checks, erasable syntax, NodeNext module semantics, rewritten relative TypeScript extensions, project references, and library isolated declarations. These options are aligned with the project's current runtime and source-first development model. `tsconfig.base.json:3`, `tsconfig.lib.json:4`. [TypeScript compiler reference](https://www.typescriptlang.org/tsconfig/).
- A read-only TypeScript API scan parsed 81 workspace tsconfigs and found 1,671 included root files, with zero uncovered tracked `.ts/.tsx/.mts/.cts` files after excluding intentional fixtures and the independently managed tutorial. This checks membership, not that all Nx targets execute correctly.
- ESLint uses flat config, `strictTypeChecked`, `stylisticTypeChecked`, `projectService: true`, and disables type-aware rules for JavaScript. Project service is the recommended approach for referenced TypeScript monorepos. React hooks checks, async safety, test linting and package-boundary checks are present. `packages/eslint/src/index.ts:121`, `:266`, `:296`. [typescript-eslint project service guidance](https://typescript-eslint.io/troubleshooting/typed-linting/), [actual typescript-eslint OSS configuration](https://github.com/typescript-eslint/typescript-eslint/blob/3728e1bd6a67892c7a127057eb6910b4b67ee119/eslint.config.mjs).
- Knip is a blocking lint target, includes private entry exports, preserves public package entrypoints, and uses mostly targeted ignore categories instead of excluding whole production areas. The existing default run passes. Ignoring public entry exports for shipped libraries is intentional and appropriate; do not blindly enable it everywhere. [Knip includeEntryExports](https://knip.dev/reference/configuration#includeentryexports). The [typescript-eslint Knip configuration](https://github.com/typescript-eslint/typescript-eslint/blob/3728e1bd6a67892c7a127057eb6910b4b67ee119/knip.ts) likewise models workspace-specific entries/fixtures; its broader disabled issue categories are a reminder that OSS configurations should be adapted rather than copied.
- Source-condition exports are deliberately removed from publish manifests (`scripts/publish-manifest.ts:46`), and the repository has isolated type-consumer checks with `skipLibCheck: false` (`packages/cli/tests/type-consumer.ts:106`) plus release consumer type checking (`scripts/release-e2e.ts:207`). Thus root `skipLibCheck: true` and a development `source` condition are not findings by themselves.
- pnpm has a shared lockfile, workspace protocol links, centralized catalogs, an integrity-pinned package manager, explicit lifecycle build permissions and narrowly versioned trust exceptions. `pnpm-workspace.yaml:21`, `:34`; `package.json:223`. Dependabot covers root npm, independent tutorial npm, Cargo, Actions and Docker. Broad overrides/peer exceptions should be periodically reviewed, but their presence alone is not a defect; the actual [Vite workspace](https://github.com/vitejs/vite/blob/bc598a6a8a6b7d6e157e9f19c16911cff8d2360c/pnpm-workspace.yaml) also uses targeted overrides, package extensions and intentional peer exceptions.

## Validation boundaries

No full lint, monorepo build/test, dependency install/audit, package publish, website browser session, or generated binding regeneration was run. The website plain-TS check and default Knip passed; no claim is made that the full CI passes. All report observations use existing workspace dependencies/generated artifacts, so strict Knip observations involving `dist` should be rerun after a clean authorized build before being promoted to release blockers. Runtime commands went through `mise exec --`; local executable paths bypassed the unavailable pnpm shim without changing the environment. The pnpm shim condition is an environment observation, not automatically a repository defect.
