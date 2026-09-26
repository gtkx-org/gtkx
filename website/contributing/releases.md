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

The workflow runs only on request and never writes to `main`.

| Inputs | Result |
| --- | --- |
| Both empty | Consume pending plans on the current release train: the next beta during beta development, or the bump requested by plans on a stable train. With no pending plans, stop without opening a pull request. |
| `specifier=2.0.0` | End the beta and prepare the stable release, even without pending plans. |
| `preid=rc` | Change the prerelease identifier, even without pending plans. |

The workflow versions all packages, updates tutorial ranges and the documentation version, prepends release notes to `CHANGELOG.md`, and deletes consumed plans. It opens or refreshes `release/next` as the release bot, with a GitHub-signed commit. Preview those preparation steps locally without writing files:

```bash
pnpm prepare-release --dry-run
```

The release GitHub App needs read and write access to contents and pull requests. Its credentials are the repository variable `RELEASE_APP_CLIENT_ID` and secret `RELEASE_APP_PRIVATE_KEY`.

For the first stable release, complete [documentation promotion](/contributing/documentation#promote-a-prerelease) on the prepared release branch before advancing `main`. Include website copy and root and package README updates so the tag contains stable commands, status, and documentation links. Version preparation updates the documentation version number but does not update that prose or move pages.

## Review and advance main

Read the pull request and check its results. Fetch and push the exact reviewed commit:

```bash
git fetch origin release/next
sha="$(git rev-parse FETCH_HEAD)"
gh pr checks <number>
git log -1 --show-signature "$sha"
git push origin "$sha:main"
```

The ruleset allows only rebase merges, which drop commit signatures. The merge button therefore cannot produce a commit that `main` accepts. Pushing the fetched, Verified commit preserves its signature and linear history and closes the pull request as merged.

This push uses the organization admin's ruleset bypass for required checks and approval. Check `gh pr checks` yourself before pushing. Use the fetched SHA: another workflow run can rebuild `release/next` into a different commit that would also fast-forward but has not been reviewed.

If `main` has moved, rerun Release PR. Do not use “Update branch”: a merge adds a second parent, violating linear history, and a rebase removes the signature.

## Tag and publish

The push starts Tag release. It recognizes a prepared release from the version's changelog entry and release state, creates the annotated `vX.Y.Z` tag and draft GitHub release, and dispatches Publish from that tag. An ordinary edit to `packages/create-gtkx/package.json` does not trigger a release. Rerunning after a failed publish redispatches the same draft.

To curate the draft notes:

```bash
gh release edit vX.Y.Z --notes-file notes.md
```

Publish takes no inputs; its dispatched ref identifies the release. The `validate-release` job rejects branch refs, tags that do not match `v` plus the version in `packages/create-gtkx/package.json`, and releases that are not drafts.

Publish builds and uploads from `refs/tags/vX.Y.Z`, then waits for every exact package version and dist-tag to appear in the registry. Only then does it publish the draft, preserving its notes, and dispatch Website for the same tag. That explicit dispatch is necessary because a release published with the workflow's token does not trigger Website itself.

## Retry a failed publish

A failed build, upload, or registry check leaves the GitHub release in draft. Fix the cause and rerun Publish on the same tag. Already-published packages are skipped; for those packages the visibility check requires only the exact version, not its dist-tag. Missing packages continue publishing.

The registry visibility timeout is ten minutes per package. `GTKX_PUBLISH_VISIBILITY_TIMEOUT_MS` overrides it for `pnpm release` or the publish scripts. It must be a positive integer in milliseconds; invalid values fail before upload. Beta 5 took three to four minutes to become visible.
