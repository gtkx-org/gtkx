# GitHub Actions, Docker, publishing, and SDLC audit

Snapshot: 2026-09-27; repository HEAD `c43a7ff610773879b0115e5bd6be60c1638c9702`. Read-only examination of tracked configuration, scripts, official documentation, exemplary OSS workflows, and authenticated GitHub GET endpoints. No workflow was dispatched, no settings were changed, no containers were operated, and no tracked files were modified. P1 means close before 2.0; P2 means worthwhile reliability or security work before release, with sequencing based on cost. Recommendations are not evidence that a bad release or compromise occurred.

## Findings

### CI-01 — P1: Publishing is not mechanically gated on the exact release commit's verification

Evidence: `.github/workflows/tag-release.yml:3-8,68-99` starts independently on a push touching the release package manifest and immediately tags/drafts/dispatches. `.github/workflows/publish.yml:21-52` checks tag name, package version, and draft state; its `publish` job depends only on `build-native` (`:85-94`), with no successful CI/checks requirement. `website/contributing/releases.md:36-52` explicitly instructs an administrator to bypass required checks and approval by pushing the signed release commit. The live Default ruleset allows OrganizationAdmin bypass `always`.

Impact: The system depends on a human inspecting the right checks before an irreversible npm publication. A release push can start Publish while main CI is still running, and the tag validation does not establish that all required checks passed for that commit. This is a control gap, not proof that historical releases failed testing.

Remediation: Make release eligibility an explicit machine check tied to the immutable commit SHA: successful complete verification and accepted review of the corresponding release candidate. Integrate the verification dependency into the release flow or verify the required check set before dispatching/publishing. Preserve draft-first and retry behavior. Add an npm release environment bound in each npm trusted-publisher configuration; restrict eligible tags, and use a reviewer only if the team's release policy calls for one. OIDC alone proves workflow identity, not successful verification. Do not use environment approval as a replacement for exact-commit verification.

The runbook also needs correction: `releases.md:48` claims the ruleset permits only rebase merges, but the live ruleset's `allowed_merge_methods` is `["squash"]`. Resolve the merge/signature process with the real settings instead of retaining routine admin bypass as the release procedure.

Verification: Read-only graph inspection and live ruleset confirmed; no publishing experiment performed. Acceptance should demonstrate that an unverified candidate cannot advance to publishing, while a verified candidate and a retry of its partial publication can. Confidence: high. Effort: medium.

Sources: [GitHub required checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks), [deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/). Both [Vite's publish workflow](https://github.com/vitejs/vite/blob/bc598a6a8a6b7d6e157e9f19c16911cff8d2360c/.github/workflows/publish.yml) and [Vitest's publish workflow](https://github.com/vitest-dev/vitest/blob/7d8ed3e9b70f23eb9c05b3693f19c528799d78cc/.github/workflows/publish.yml) separate detection from a publish job using `environment: Release`. These are patterns to adapt, not proof that every aspect of those projects is ideal for GTKX.

### CI-02 — P1: ASAN and documentation verification run but do not gate merging

Evidence: `.github/workflows/ci.yml:573-609` has the ASAN shards and a correct always-running `asan` aggregate; `:260-275` builds documentation. The live active [Default ruleset](https://github.com/gtkx-org/gtkx/rules/10783585) requires `lint`, `test`, `typecheck`, `SonarCloud Code Analysis`, all three CodeQL language checks, `publish-e2e`, `test-cli`, and `plan-check`; it does not require `asan` or `docs`. Existing `test`/`test-cli`/`publish-e2e` aggregates do not include them.

Impact: A memory-safety canary or docs build may fail while the actual required gate set passes. Docs-only PRs intentionally skip most checks, making the missing docs requirement especially relevant.

Remediation: Require the existing ASAN aggregate and a robust docs aggregate, or define a single stable always-running `ci-success` job that validates every expected job according to the change classification. Preserve fail-closed handling of upstream failures and distinguish intentional skips from missing execution. Bind `test-cli` to the Actions integration like the other checks; currently it is the only listed required check with no `integration_id`.

Verification: Actual ruleset and workflow dependencies inspected. Validate a documentation build failure, an ASAN failure, and a legitimate docs-only change in a controlled PR before adopting the aggregate. Confidence: high. Effort: small.

Source: [GitHub's skipped/required-check behavior](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks). GitHub treats some skipped jobs as successful; the project's existing explicit aggregate assertions are a strong pattern to extend.

### CI-03 — P1: Published arm64 native artifacts have no runtime acceptance gate

Evidence: `.github/workflows/publish.yml:54-84` builds and uploads x64 and arm64 binaries, then `:85-157` publishes them. All PR test, ASAN, and published-consumer jobs run on `ubuntu-latest` x64 (`ci.yml:300-717`); the arm runner at `:84-85` builds only the CI image. No release job consumes each uploaded binary in an actual application before publication. `scripts/prepublish-native.ts:36-56` copies the per-platform binary into the package and publishes it.

Impact: Successful compilation does not establish that the arm64 addon loads, resolves its native libraries, or runs GTKX's consumer path. PR consumer acceptance is substantial, but it verifies the x64 build made in that PR, not both exact release artifacts.

Remediation: Stage the real release packages/binaries and run a small consumer smoke flow on both native architectures before npm publication. Exercise installation through the platform package, native load, codegen/build, and one real headless application interaction. Add a defined oldest-supported GTK/Adwaita/glibc image alongside the normal current image if broad Linux compatibility is intended. The minimum system-library/ABI floor should be measured, not inferred from successful compilation on Ubuntu 26.04. This audit did not establish a current ABI incompatibility.

Verification: Workflow graph confirms the missing stage; no native binaries were run or analyzed in this slice. Acceptance must use the uploaded artifact checksums to prove the tested binaries are the ones shipped. Confidence: high for missing ARM acceptance; medium for compatibility risk. Effort: medium.

Reference pattern: [Vite CI](https://github.com/vitejs/vite/blob/bc598a6a8a6b7d6e157e9f19c16911cff8d2360c/.github/workflows/ci.yml) distinguishes build/runtime versions and exercises supported runtime/OS combinations. GTKX needs an analogous, smaller native platform contract rather than copying Vite's matrix.

### CI-04 — P2: CI image reuse freezes mutable inputs indefinitely and cannot recreate the same environment reliably

Evidence: `.github/workflows/ci.yml:105-130,186-220` skips building whenever the `df-${hashFiles('.github/docker/**')}` tag exists. There is no image refresh schedule. `.github/docker/Dockerfile:2,8-66` uses a mutable Ubuntu tag and unversioned apt packages, including the proposed GTK archive preference (`:11-17`). `pull-image/action.yml:20-50` rebuilds from live repositories whenever a requested image cannot be pulled, including release jobs. The returned reference is a recipe tag, not the manifest digest. Dependabot's Docker entry (`dependabot.yml:48-51`) is useful, but a version-tag check does not itself refresh apt packages inside an already-reused image.

Impact: Unchanged Dockerfile text means stale OS packages may persist indefinitely. A later fallback/rebuild can silently resolve different OS/library contents for the same recipe. This affects reproducibility, debugging, support-floor confidence, and patch uptake. Nx includes the pulled image's immutable ID in shared inputs, which correctly limits stale cache reuse for targets honoring those inputs; it does not solve image freshness.

Remediation: Introduce an explicit, reviewed image refresh lifecycle: pin the base digest; periodically update it and rebuild package layers; record native package/tool versions; publish an immutable manifest digest and pass that digest through downstream jobs. Record the accepted digest for releases. Decide explicitly which package sources are stable baseline versus forward-compatibility lanes, and remove or time-bound the proposed/update exclusions when no longer needed. Fail a release if its required verified image is unavailable rather than silently constructing a different environment. Keep a separate fallback for unprivileged PRs if desired.

Verification: Static configuration confirms reuse/fallback rules; no image build was performed. Acceptance: rebuilding from a scheduled refresh changes the image identity and invalidates relevant tasks, while a release consistently selects the recorded digest. Confidence: high. Effort: medium.

Sources: [Docker build best practices](https://docs.docker.com/build/building/best-practices/) recommends digest pinning and regular rebuilds; [Docker multi-platform CI](https://docs.docker.com/build/ci/github-actions/multi-platform/) supports native per-platform builds and final manifest assembly. The current native runner matrix and digest assembly are already aligned with that pattern.

### CI-05 — Validation question: Confirm the initial Dependabot image-refresh path

Evidence: `ci.yml:92,158` sets `CAN_PUSH` when the PR's head repository equals this repository. Dependabot PRs use same-repository branches. Both image jobs explicitly request `packages: write`, which matters: GitHub's current Dependabot troubleshooting documentation permits increasing the token's default scopes through `permissions`. The condition alone therefore does not establish a permission defect.

Open question: Ordinary dependency PRs whose recipe image already exists do not exercise image publication. Validate an initial automated change affecting `.github/docker/**`, including GHCR login, native builds, and manifest assembly. No failing Dependabot image update was established, and this item is excluded from the confirmed findings and release priorities.

Follow-up: Make image publication eligibility explicit and retain a supported no-push path. For fork/image PRs, consider building once per architecture and sharing a same-run artifact instead of independently rebuilding in many test jobs. This is a separate optimization; a build artifact from untrusted code must retain that trust classification.

Validation: Inspect the next initial automated image-refresh run using existing permissions. No new credentials or privileged execution of untrusted code are required to answer the question. Confidence: unresolved operational behavior, not a demonstrated defect.

Source: [GitHub Dependabot token permission guidance](https://docs.github.com/en/code-security/reference/supply-chain-security/troubleshoot-dependabot/dependabot-on-actions#changing-github_token-permissions).

### CI-06 — P2: Publication serialization is per version, while npm channels are shared across versions

Evidence: `publish.yml:10-12` uses `publish-${{ github.ref }}`. `scripts/publish-manifest.ts:28-38` maps all stable versions to `latest` and each prerelease train to one channel; `scripts/pnpm-publish.ts:34-42` updates that channel during each package publish. The monorepo release is dependency-ordered (`nx.json:153-159`) but two different release refs can run simultaneously.

Impact: Cross-version publishes or retries can overlap and interleave dist-tags across a fixed-version package family. `cancel-in-progress: false` only prevents canceling the same ref; it does not serialize shared npm channel updates. This is a race condition inferred from the graph, not an observed registry incident.

Remediation: Serialize publications globally or at least per release channel, with an explicit queued policy. Make promotion of the complete accepted package set a distinct step, and verify channel consistency before publishing the GitHub release. Require monotonic channel promotion unless a rollback is explicitly intended: serialization alone does not prevent an older partial release retry from assigning an older tag to packages it had not yet published. Existing handling protects already-published packages, not every partial retry. Evaluate npm's staged publishing only if review of exact tarballs is wanted; its additional human approval is a policy choice, not a required migration.

Verification: In a disposable local registry, exercise two candidate versions and interrupted/retried publication, then assert observable installed versions/dist-tags. Do not test this race against npm production. Confidence: high. Effort: medium.

Sources: [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), [npm staged publishing](https://docs.npmjs.com/staged-publishing/). The current docs support `queue: max`; verify runner/service support at implementation time. [Vitest's publish workflow](https://github.com/vitest-dev/vitest/blob/7d8ed3e9b70f23eb9c05b3693f19c528799d78cc/.github/workflows/publish.yml) now stages publishing and supplies a concrete adoption reference.

### CI-07 — P2: Several implemented security conventions are not enforced at repository level

Verified live configuration:

| Control | Observed state | Recommended action |
| --- | --- | --- |
| GitHub immutable releases | `enabled:false`, `enforced_by_owner:false`; 1.6.0 and beta.10 mutable | Enable for future releases; current draft-first publication is compatible. |
| Action SHA pinning policy | `sha_pinning_required:false`; `allowed_actions:all` | Require SHA pinning to preserve the already-followed convention; consider a maintained action allowlist only if worth the administration. |
| Secret scanning | Enabled, push protection disabled | Enable push protection to prevent supported credential types entering history. |
| Code owner review | Required in ruleset; no CODEOWNERS file found in the repository | Add owners for workflow/release/native critical paths, or remove a misleading control if individual owner review is not the policy. |
| Release tag protection | Only the default-branch ruleset is present, including inherited rules | Protect `v*` creation/update/deletion appropriately; immutability locks tags only after publication. |
| Pages environment | No deployment branch/tag policy or reviewers | Limit to intended deployment refs. Reviewers are optional if the exact-ref release gate is automatic. |

Impact: Current good source conventions can regress without enforcement, and already-published release tags/assets remain changeable. These are defense improvements, not evidence of active misuse. Enable settings through a reviewed repository-configuration procedure; this audit changed nothing.

Sources: [immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases), [enabling immutability](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes), [GitHub Actions policy](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository), [GitHub secure workflow guidance](https://docs.github.com/en/actions/reference/security/secure-use). Confidence: high; settings were read directly. Effort: small, plus policy decisions.

### CI-08 — P2: The workflow/Docker/shell configuration lacks dedicated correctness linting

Evidence: Seven workflows and eight composite actions contain substantial Bash, YAML expressions, native package setup, and release orchestration. Root `package.json:14` runs ESLint/Rust/Knip; no actionlint, ShellCheck, or Dockerfile lint/check target appears in the tracked configuration. CodeQL already scans the Actions language (`codeql.yml:30-41`) and must be credited; it does not replace all workflow type/syntax, shell, or Dockerfile diagnostics.

Remediation: Add a fast, unprivileged configuration lint job using a pinned actionlint with ShellCheck, Docker build checks or a selected Dockerfile linter, and optionally zizmor where it adds findings beyond existing Actions CodeQL. Pin the toolchain and record any local installation in the workstation configuration rather than installing unmanaged tools. Keep the job independent of native image creation so malformed orchestration fails early. Adopt targeted rules with reviewed exceptions; do not accumulate overlapping scanners merely for appearance.

Verification: No dedicated tools were installed or run in this audit; recommendation is based on tracked target inventory. Acceptance should check real workflows/composites and pass without network credentials. Confidence: high for the gap, medium for incremental benefit of zizmor given existing CodeQL. Effort: small.

Sources: [actionlint](https://github.com/rhysd/actionlint), [zizmor](https://zizmor.sh/), [Vite's zizmor workflow](https://github.com/vitejs/vite/blob/bc598a6a8a6b7d6e157e9f19c16911cff8d2360c/.github/workflows/zizmor.yml), [Docker's validation workflow](https://github.com/docker/build-push-action/blob/c3c9e263c25d99ce0380d002d59b67737d91b0dc/.github/workflows/validate.yml).

### CI-09 — P2: Fork PR analysis has no explicit path through the required authenticated Sonar check

Evidence: Both Sonar branches in `ci.yml:231-258` run for PRs with `secrets: inherit`. `sonarcloud.yml:65-71` unconditionally runs the authenticated scanner. The required check is `SonarCloud Code Analysis`. Fork PR workflows receive no repository secrets. Dependabot is separately provisioned with a `SONAR_TOKEN` Dependabot secret, which is good and avoids conflating the two cases.

Impact: The image action explicitly supports fork PRs, but the complete required-check pipeline cannot obtain its Sonar token in that trust context. A maintainer needs an explicit supported contribution procedure instead of ad hoc retries or bypasses. No fork PR was executed to reproduce the resulting check state.

Remediation: Define and document a safe Sonar/fork contribution path compatible with Sonar's supported integration and the project's gate policy. Sonar documents automatic analysis without coverage, or separate unprivileged build and trusted analysis that never executes fork code. Assess these against the existing coverage gate. Keep untrusted build execution unprivileged; do not run PR code in a privileged `pull_request_target` workflow. If trusted review/branch promotion is required, bind it to the reviewed SHA. Assess the gate outcome in a normal fork contribution.

Confidence: high for unavailable secret and unconditional scanner; medium for exact external Sonar check behavior without a fork run. Effort: medium. Sources: [Sonar's supported fork analysis patterns](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/github-actions-for-sonarcloud#analyzing-fork-pull-requests), [GitHub secure workflow guidance](https://docs.github.com/en/actions/reference/security/secure-use).

### CI-10 — P2: Downloaded image toolchains are version-pinned but not content-verified

Evidence: `.github/docker/Dockerfile:79-89` pipes a Node tarball directly to extraction and checks only `node --version`; `:108` executes the mutable rustup installer URL. TLS and exact Node/Rust version declarations are useful, but there is no persisted checksum/signature verification of these downloaded artifacts. Versions are repeated between the Dockerfile, `mise.toml`, `rust-toolchain.toml`, package manager metadata, and `sonarcloud.yml:44,49`; existing Dependabot ecosystems do not cover all arbitrary ARG/curl toolchain pins.

Remediation: Verify the official Node signed checksums or a reviewed per-architecture checksum before extraction. Pin/verify installer artifacts or consume a pinned official toolchain image/stage. Automate consistent toolchain updates across declarations and have a CI assertion for synchronization. Keep the Flatpak tooling's explicit commit pin (`Dockerfile:68-74`).

Verification: Static inspection only; no download was executed. Confidence: high. Effort: small to medium. Reference implementation: [official Node Dockerfile](https://github.com/nodejs/docker-node/blob/766ca4f1bbe23ad677622808b0131b4e51f7fc01/24/bookworm/Dockerfile), which checks the signed SHASUMS before extraction.

## Practices already worth preserving

- External Actions references inspected are full commit SHAs, and Dependabot updates npm (including the separate tutorial), Cargo, Actions/composites, and Docker daily with sensible grouping.
- Explicit job permissions, read-only default workflow permissions, disabled bot PR approvals, no `pull_request_target` build, scoped release App token creation, and GitHub-hosted ephemeral runners establish a good baseline.
- Rootless Podman runs drop all capabilities and disallow privilege escalation (`run-in-container/action.yml:39-43`); no Docker socket is mounted into the test container.
- Frozen pnpm installs, lockfile-keyed package/registry caches, native architecture-separated Docker cache scopes, and image identity in Nx shared inputs are sound foundations. Do not introduce caching of side-effectful release targets.
- The existing `test`, `test-cli`, `asan`, and `publish-e2e` aggregate checks explicitly assert expected dependencies instead of accepting arbitrary skips.
- Native images build on real x64/arm64 runners and are assembled through digest artifacts; production native builds explicitly skip Nx build cache.
- Release package validation is stronger than a typical library: real Verdaccio publishing, scaffold/build/run consumer acceptance, tutorial acceptance, published manifest/source-map/export shape checks, and exact-version registry visibility polling.
- OIDC publishing and provenance are already present. The GitHub draft remains unpublished until package publication succeeds; retries distinguish existing versions; release tags are checked against the target commit before creation.
- CodeQL scans Actions, TypeScript/JavaScript, and Rust with security-extended queries, including a weekly schedule. Secret scanning and Dependabot security updates are enabled.
- Sonar's actual remote quality gate was verified, not guessed from Vitest settings: `Sonar way`, coverage on new code >=80% (current 86.7%), new duplication <=3%, A reliability/security/maintainability ratings, and 100% reviewed security hotspots. The main project gate was `OK`. The rule is required for merges.

## Evidence and limits

The relevant live GET snapshots are retained in [evidence.json](./evidence.json), along with the inspected CI job timings and selected Nx graph/task-plan evidence. Individual raw inspection files under `/tmp` are temporary working material.

Public Sonar endpoints inspected: `https://sonarcloud.io/api/qualitygates/get_by_project?project=gtkx-org_gtkx&organization=gtkx-org` and `https://sonarcloud.io/api/qualitygates/project_status?projectKey=gtkx-org_gtkx`. Do not misreport the legacy `branches/main/protection` 404 as an unprotected branch; protection is implemented by rulesets.

Recent release evidence: [beta.10 Publish run](https://github.com/gtkx-org/gtkx/actions/runs/34510166918) succeeded; native builds took approximately two minutes each and publication 17m22s. That is evidence that the present happy path works, not that all edge cases above are covered. Recent successful [PR CI](https://github.com/gtkx-org/gtkx/actions/runs/36329827600) was inspected; performance analysis is handled in the root audit.

Not available/verified: npm package-side trusted-publisher bindings, token restrictions/2FA policy, Nx Cloud token permission configuration, retention/history of actual CI image digests, reproducible output hashes, private org policy beyond inherited ruleset/API results, and live behavior of a fork PR or automated Docker-update PR. No tests were added or executed, and no vulnerability or offensive workflow was reproduced.
