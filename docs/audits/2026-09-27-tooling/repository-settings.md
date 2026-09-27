# Repository settings prepared for owner review

These payloads describe the remaining external settings changes. They have not been applied. The [read-only snapshot](./repository-settings/snapshot.json) was refreshed on September 27, 2026. The default ruleset still requires ten individual checks, permits organization administrators to bypass directly, and requires code-owner review without a CODEOWNERS file. Action SHA enforcement, push protection, and immutable releases remain disabled. `npm-release` does not exist, and `github-pages` has no deployment-ref restrictions.

## Apply after the workflow changes land

The table gives the method and repository-relative REST path for each reviewed payload. Prefix paths with `repos/gtkx-org/gtkx/`. Use GitHub's `2026-03-10` API version. Read the current resource before writing and compare it with the snapshot; merge any intervening changes instead of replaying an old full rules array.

| Change | Request | Payload | Acceptance |
| --- | --- | --- | --- |
| Require the complete CI aggregate | `PUT rulesets/10783585` | [default-required-checks.json](./repository-settings/default-required-checks.json) | `ci-success` is bound to GitHub Actions, and `test-cli` gains the same app binding. Existing required checks and unrelated rules remain. |
| Enforce action commit pins | `PUT actions/permissions` | [actions-sha-pinning.json](./repository-settings/actions-sha-pinning.json) | `sha_pinning_required` is true; the existing action allow policy remains. |
| Enable secret push protection | `PATCH` the repository itself | [push-protection.json](./repository-settings/push-protection.json) | `security_and_analysis.secret_scanning_push_protection.status` is `enabled`. |
| Create the npm release environment | `PUT environments/npm-release` | [restricted-environment.json](./repository-settings/restricted-environment.json) | Custom deployment policies are enabled. |
| Admit only release tags to npm publishing | `POST environments/npm-release/deployment-branch-policies` | [release-tag-policy.json](./repository-settings/release-tag-policy.json) | The policy has type `tag` and pattern `v*`; branch refs are absent. |
| Restrict Pages deployments | `PUT environments/github-pages` | [restricted-environment.json](./repository-settings/restricted-environment.json) | Custom deployment policies are enabled. |
| Admit release tags to Pages | `POST environments/github-pages/deployment-branch-policies` | [release-tag-policy.json](./repository-settings/release-tag-policy.json) | The release workflow can deploy its tag. |
| Preserve release tags before publication | `POST rulesets` | [release-tag-immutability.json](./repository-settings/release-tag-immutability.json) | `v*` tags cannot be updated or deleted; creation remains available to the release workflow. |
| Enable immutable GitHub releases | `PUT immutable-releases` | No body | `GET immutable-releases` reports `enabled: true`. |

Activate `ci-success` only after it has completed on an ordinary PR and a docs-only PR, and after a failed required dependency has been observed to fail it. The workflow also attaches ASAN, docs, and tooling lint to the already-required `test` aggregate, so those checks are enforced while the settings update is pending. Keeping the old checks during migration makes the change additive. A later review can simplify the required-check list once all contribution paths are proven. [Required checks and rules API](https://docs.github.com/en/rest/repos/rules), [Actions permissions API](https://docs.github.com/en/rest/actions/permissions).

The `npm-release` environment must also be configured in the trusted publisher of every published npm package, including both native platform packages. The intended identity is organization `gtkx-org`, repository `gtkx`, workflow `publish.yml`, environment `npm-release`. Confirm the existing npm publishing access policy and provenance behavior for each package; npm account settings were not available in this audit. The workflow's exact-commit verification remains mandatory whether or not environment reviewers are added. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

Environment policy creation is not an upsert: list existing policies first, add missing entries, and remove conflicting branch policies only after owner review. The Pages `main` policy is a separate [optional payload](./repository-settings/pages-main-policy.json): apply it only if manual deployment of the unreleased main documentation is intended. Release-only Pages deployment needs only the tag policy. [Environment API](https://docs.github.com/en/rest/deployments/environments), [deployment branch policy API](https://docs.github.com/en/rest/deployments/branch-policies).

The draft-first workflow is compatible with immutable releases: release notes can be curated while the release is a draft, and package/channel failures leave it unpublished. Immutability applies to releases published after activation and does not repair past releases. Decide whether existing drafts should be published under the new policy before enabling it; do not move or recreate tags of a published release to recover a failed job. [Immutable release behavior](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes), [repository API](https://docs.github.com/en/rest/repos/repos#enable-immutable-releases).

## Owner decisions before additional restrictions

| Decision | Prepared change | Consequence |
| --- | --- | --- |
| Restrict administrator bypass to PRs, or remove it entirely | [default-pr-only-bypass.json](./repository-settings/default-pr-only-bypass.json), applied with `PUT rulesets/10783585`, limits the existing organization-admin bypass to PRs | Direct unchecked pushes lose their routine bypass. Administrators can still bypass PR requirements; the separate release gate rejects unreviewed or unverified commits. Removing bypass entirely requires a separately approved empty `bypass_actors` array. |
| Allow the GitHub Actions app to create tags, or introduce a dedicated release identity | [release-tag-creation-github-actions.json](./repository-settings/release-tag-creation-github-actions.json), applied with `POST rulesets`, allows Integration `15368` to bypass the creation restriction | This matches the current Tag release token identity. API acceptance of the built-in Actions app as a bypass actor has not been tested; confirm it is eligible before activation. If accepted, every workflow granted `contents: write` is within that trust boundary. A narrower dedicated App requires changing Tag release authentication and substituting its confirmed App ID before activation. |
| Select code owners for release/workflow/native changes | Add `.github/CODEOWNERS` using confirmed team or maintainer identities with repository write access | No owner identity was invented. Cover `.github/`, `scripts/*release*`, publishing scripts, `packages/native/`, and dependency/toolchain declarations. If owner review is not desired, remove the existing requirement through a separate reviewed ruleset change. |
| Add human release environment approval | Configure named reviewers and self-review policy on `npm-release` | This adds a publication approval step. The proposed environment payload only restricts refs and does not select reviewers. |
| Broaden Linux ABI support below the verified image | Establish a supported GTK, Adwaita, and glibc floor, then add an acceptance image | The implemented native matrix proves x64 and arm64 artifacts in the verified current image. It does not establish compatibility with an older distribution. |

Creation and immutability are deliberately separate tag rulesets: a tag-creation bypass must not also grant permission to update or delete release tags. GitHub administrators who can edit rulesets remain an administrative trust boundary. [Ruleset bypass behavior](https://docs.github.com/en/rest/repos/rules#update-a-repository-ruleset).

## Verification and retained limits

All supplied JSON files parse locally. Existing settings were inspected with GET requests only. No environment, repository policy, npm binding, release, tag, or pull request was changed remotely. A post-merge controlled workflow run must verify the new GitHub environment and checks; the first real npm release must verify the package-specific trusted-publisher bindings and token exchange. A disposable Verdaccio run validates staged publication, complete channel promotion, retry behavior, and installed package versions without writing to npm production.

The fork Sonar contribution path and the first Dependabot image rebuild still need observation in their real GitHub trust contexts. Keep the required external Sonar check until the documented contribution path succeeds; do not replace authenticated analysis with an unconditional successful placeholder.
