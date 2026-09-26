---
title: "Maintaining Documentation"
description: "Edit and verify the GTKX website, maintain versioned references, and promote a documentation release."
---

# Maintaining Documentation

## Edit and preview

The VitePress site lives in `website/`. Run these commands from the repository root:

```bash
pnpm nx run @gtkx/website:dev
pnpm nx run @gtkx/website:build
```

Both targets generate API pages from package output before starting VitePress. Build the site and inspect the rendered pages after editing prose, navigation, or theme components.

Edit exported API documentation at its package source, then regenerate it. Generated reference files are overwritten. The project widget reference in `.gtkx/reference` describes generated elements and their props; the website package reference describes helpers exported by GTKX packages.

Guides and tutorials explain tasks; API reference pages describe callable contracts. Use small examples, link to reference details, and assume familiarity with React and TypeScript. The [documentation principles](/contributing/principles#write-focused-consistent-documentation) cover style and scope.

## Documentation versions

[`website/versions.json`](https://github.com/gtkx-org/gtkx/blob/main/website/versions.json) defines each documented version:

| Field | Purpose |
| --- | --- |
| Version id and label | Identify the version and label its switcher entry. |
| URL prefix | Place its guides, tutorial, and reference. |
| Aliases | Retain previous prefixes with static redirects and text downloads. |
| Status | Mark it as `current`, `prerelease`, or `old`. |
| Examples ref | Select the git ref used by the Examples navigation link. |
| Reference source | Build the API reference from `worktree` or a pinned `tag` and commit. |

The manifest drives navigation, sidebars, page mapping between versions, banners, canonical URLs, per-version `llms.txt` and `llms-full.txt`, and TypeDoc output paths.

Exactly one version must use `worktree`; the build rejects any other count. Its empty `label` derives from the manifest's `packageVersion`, which release preparation synchronizes with the package version. A tag-pinned version records its shipped label and rebuilds from the specified tag and commit, keeping its API reference tied to the release. Each release tag retains one working-tree entry so its own checkout can regenerate that reference when archived.

Between releases, the current version uses the working tree and follows `main`. When adding the next prerelease, make it the working-tree version, pin the outgoing current reference to its release tag and commit, and write its derived label into the manifest.

Reference generation checks the Nx output paths in `website/package.json` against the manifest. A mismatch fails the build because stale paths could restore cached output to the wrong directory. Synchronize declarations after changing prefixes:

```bash
pnpm --filter @gtkx/website reference-sync
```

## Add or move pages

Guide and tutorial pages live under their version's prefix: `website/guide` for the root version and `website/v2/guide` for `/v2`. Register them in `guideItems` or `tutorialItems` in `website/.vitepress/versioning.ts`. The build rejects unlisted pages so versions cannot silently diverge.

Contributor pages follow `main` independently of releases. Register them in `website/.vitepress/contributing.ts`. They appear in every version's navigation, search, and `llms.txt` exports, and remain at `/contributing/` during promotion.

Keep existing heading anchors when reorganizing a page, or leave links to the moved material. Check links in both rendered pages and generated reference output.

## Promote a prerelease

Complete promotion on the prepared release branch before advancing `main`. That push starts tagging and publishing automatically; the tag must already contain the stable documentation and package READMEs.

1. [Prepare the stable release](/contributing/releases#prepare-a-release) with `specifier=2.0.0`, then check out the resulting `release/next` branch. Confirm that package versions and `website/versions.json`'s `packageVersion` are `2.0.0`. Promotion changes documentation placement; it does not bump the release version. For a local rehearsal, run `pnpm prepare-release --specifier 2.0.0` in an isolated checkout instead.
2. Before retiring an existing `old` version, review links to its prefix and aliases, including historical posts. Point those links to a supported guide or a source permalink at the appropriate release tag. Delete the retired version's directories and manifest entry, then run `pnpm --filter @gtkx/website reference-sync`. Promotion refuses to proceed while an old version remains. The outgoing current version must already have a pinned reference tag and commit.
3. Move the current documentation to its archive prefix and the prerelease to the root:

   ```bash
   pnpm --filter @gtkx/website promote-version --to /v1 --examples-ref v2.0.0
   ```

4. Review release copy in the promoted `website/guide`, `website/tutorial`, contributor pages, landing components, root `README.md`, and `packages/*/README.md`. Replace beta installation commands and current-release status text with stable equivalents. Point 2.0 links at the new root paths and 1.x links at `/v1`; retain historical beta references in release posts and migration explanations. Archived 1.x installation commands must remain pinned to 1.x. Keep the root README's link to `FUNDING.md`.
5. Regenerate both API references and build the site:

   ```bash
   pnpm nx run @gtkx/website:build
   pnpm nx run @gtkx/website:preview
   ```

   Check the landing links, version switcher, guide and tutorial sidebars, local search, generated references, old page anchors, and each version's `llms.txt` and `llms-full.txt`. The promoted version should be labeled stable, and archived pages should show their old-version banner. Inspect the root and archived Markdown downloads too.
6. Include these changes in the reviewed, signed release-branch history, then follow [Review and advance main](/contributing/releases#review-and-advance-main). A subsequent Release PR workflow run rebuilds that branch from `main`; it must not discard the reviewed promotion changes.

The script moves each version's `guide`, `tutorial`, and `reference` directories, updates `versions.json`, and synchronizes the Nx reference output paths. It rewrites absolute documentation links in website Markdown by the version they target, preserving intentional links between versions. It does not rewrite beta prose or package commands, and it does not edit files outside `website/`. Generated reference links are corrected by regeneration.

Promotion keeps the new current reference on `worktree`. Pinning it now would leave no working-tree version; wait until adding the next prerelease, as described above.

Promotion records the former prerelease prefix in the version's `aliases`. The production build emits static redirects for its guide, tutorial, and reference pages, preserving URL queries and heading fragments. It also copies Markdown downloads and `llms` exports under that prefix. Aliases stay out of navigation, search, and the sitemap; their canonical URLs point to the version's current pages. They follow the version when it is archived and disappear when its manifest entry is retired.

An old page uses the current version's corresponding page as its canonical URL when that page exists. Otherwise it keeps its own canonical URL, including reference pages for removed symbols.
