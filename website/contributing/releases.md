---
title: "Publishing Releases"
description: "Prepare, review, tag, and publish a GTKX release, and recover an interrupted publish."
---

# Publishing Releases

This runbook is for maintainers. Contributors record package changes with [version plans](https://github.com/gtkx-org/gtkx/blob/main/CONTRIBUTING.md#add-a-version-plan).

## Prepare a release

Run the Release PR workflow from GitHub Actions or the CLI:

```bash
gh workflow run release-pr.yml
```

Release preparation runs only on request and never writes to `main`. The same workflow tags prepared releases after main CI succeeds.

| Inputs            | Result                                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Both empty        | Consume pending plans on the current release train: the next beta during beta development, or the bump requested by plans on a stable train. With no pending plans, stop without opening a pull request. |
| `specifier=2.0.0` | End the beta and prepare the stable release, even without pending plans.                                                                                                                                 |
| `preid=rc`        | Change the prerelease identifier, even without pending plans.                                                                                                                                            |

The workflow versions all packages, updates tutorial ranges and the documentation version, prepends release notes to `CHANGELOG.md`, and deletes consumed plans. It opens or refreshes `release/next` as the release bot, with a GitHub-signed commit. Preview those preparation steps locally without writing files:

```bash
pnpm prepare-release --dry-run
```

The release GitHub App needs read and write access to contents and pull requests. Its credentials are the repository variable `RELEASE_APP_CLIENT_ID` and secret `RELEASE_APP_PRIVATE_KEY`.

For the first stable release, complete [documentation promotion](/contributing/documentation#promote-a-prerelease) on the prepared release branch before advancing `main`. Include website copy and root and package README updates so the tag contains stable commands, status, and documentation links. Version preparation updates the documentation version number but does not update that prose or move pages.

## Review and advance main

Review `release/next`, approve its latest commit, and wait for its required checks. Merge through GitHub using the repository's configured squash method. GitHub creates the signed commit on `main`; CI then verifies that exact merge commit. If `main` has moved or the prepared release changes, refresh the release PR and review the new head before merging.

Repository merge rules enforce review approval, the `Verify workspace` check, and CodeQL merge protection. Release automation relies on those rules. CodeQL also runs on `main`, independently of CI; tagging does not wait for that analysis.

## Tag and publish

Successful completion of main CI starts the tag job in Release PR. It requires that commit to be the merge of `release/next` and recognizes a prepared release from the version's changelog entry and release state. It creates the annotated `vX.Y.Z` tag and draft GitHub release, then dispatches Publish from that tag. A normal commit without a prepared version does not publish. Rerunning the successful CI run can redispatch the same draft.

To curate the draft notes:

```bash
gh release edit vX.Y.Z --notes-file notes.md
```

Publish takes no inputs; its dispatched ref identifies the release. Validation requires a tag matching the package version and a matching draft release. When dispatching Publish manually, maintainers are responsible for selecting a reviewed release commit with successful CI.

Both native binaries and their generated JavaScript and type declarations are built on Ubuntu 26.04 runners and uploaded with SHA-256 checksums. Separate x64 and arm64 jobs publish the staged binary to a disposable registry, scaffold consumers, verify the installed binary and generated bindings against those checksums, run codegen and builds, and exercise the generated application's headless tests. After dependency installation, `pnpm release --from-artifacts` selects the `release-artifacts` Nx configuration throughout the release dependency graph. The publication build verifies and restores the staged native bindings without recompiling. Publication requires both architectures to produce identical shared JavaScript and declarations.

Every Publish run shares a single queue, including different versions and retries. Each package is published directly to its stable or prerelease channel with `pnpm publish --tag`, and its exact version and channel tag must become visible before publication continues. The channel can only move forward. npm cannot publish multiple packages atomically, so channel tags advance package by package. An interrupted publication leaves the GitHub draft unpublished, and a retry publishes the remaining packages and verifies the complete channel.

The final job freshly checks every exact package version and channel before publishing the GitHub draft, preserving its notes, and dispatching Website for that tag. A retry of that job fails if a newer release has advanced any package channel. This dispatch is needed because releases published with the workflow token do not trigger Website themselves.

The publication job uses the `npm-release` GitHub environment. Configure each npm trusted publisher to allow `npm publish` and require that environment and this workflow, restrict eligible release tags in GitHub, and enable immutable releases. Environment reviewers are optional. The publishing client authenticates through [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and sets the channel tag as part of publication. The workflow does not use separate `npm dist-tag` updates or `npm stage publish`.

## Retry a failed publish

A failed build, upload, or registry check leaves the GitHub release in draft. Fix the cause and rerun Publish on the same tag. Already-published versions are skipped and checked for both exact-version visibility and the expected channel tag. Missing packages are published directly to that channel, then the complete package family is verified. If any package in the channel has advanced beyond the candidate version, the retry fails before uploading anything. An old partial release cannot move the channel backwards; prepare a newer release to supersede it.

If an existing version has a missing or incorrect channel tag, the retry fails rather than attempting a separate tag update with OIDC. A maintainer must correct the tag through authenticated npm access, or prepare a newer release. Existing package versions and Git release tags must remain unchanged.

If the GitHub release was published but the Website dispatch failed, rerun only the failed `publish-release` job. It recognizes the already-published release and retries the Website dispatch without changing the immutable release. Starting a new full Publish run still requires a draft.

The registry visibility timeout is ten minutes per package. `GTKX_PUBLISH_VISIBILITY_TIMEOUT_MS` overrides it for `pnpm release` or the publish scripts. It must be a positive integer in milliseconds; invalid values fail before upload. Beta 5 took three to four minutes to become visible.
