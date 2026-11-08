---
title: "Maintaining Documentation"
description: "Edit and verify the GTKX website, maintain versioned references, and promote a documentation release."
---

# Maintaining Documentation

This page covers editing and checking the gtkx.dev website, its pictured samples and brand assets, and the versioned documentation, including promoting a prerelease to stable.

## Edit and preview

The VitePress site lives in `website/`. Run these commands from the repository root:

```bash
pnpm nx run @gtkx/website:dev
pnpm nx run @gtkx/website:build
```

Both targets build the packages and generate the API reference with [TypeDoc](https://typedoc.org/) before running VitePress. Build the site and inspect the rendered pages after editing prose, navigation, or theme components.

The API reference is generated from the JSDoc in each package's source, so edit the comment there and regenerate; edits to generated reference files are overwritten. It covers the helpers GTKX packages export. Widget elements and their props are documented in each app's generated [`.gtkx/reference`](/contributing/code-generation) instead.

The [documentation principles](/contributing/principles#write-focused-consistent-documentation) cover style and scope.

## Structure and style

Keep the main navigation focused on the Guide, Config, Tutorial, API Reference, and Examples. Project resources belong in the Project menu. Add a guide to the sidebar group that matches the reader's task, and keep the tutorial in chapter order.

Use the [React documentation](https://react.dev/learn) as a reference for separating learning from API lookup, the [Vue guide](https://vuejs.org/guide/introduction.html) for topic grouping and learning paths, and [Electron's documentation](https://www.electronjs.org/docs/latest/) for the desktop workflow from setup to distribution. GTKX examples must still use this project's generated APIs; upstream GTK or Adwaita examples describe native concepts, not GTKX syntax.

Start a page with its purpose and prerequisites. Explain the GTKX-specific steps and link to reference details. Every page ends with a pager to the previous and next sidebar entries, so add a `## Next` section only when the reader's next step leaves the sidebar order, such as Getting Started pointing to the tutorial. Prefer complete, small examples over repeated API inventories. Package READMEs should identify the package, show installation or its intended entry point, and link to the matching guide and reference. Package descriptions and keywords should describe that package's role and relevant integrations.

Describe observable behavior and explain its limits. Avoid unsupported performance claims and words such as "easy" or "simple" that substitute for explaining a task.

List command or tool options in a table whose first header is `Option` or `Tool`, with the default or a short attribute next and the description last. On phones the site stacks each row of such a table into an entry.

Check commands, imports, exported names, defaults, and requirements against the version being documented. The working tree is authoritative for the development docs; use the pinned release for stable docs. Preserve historical release announcements and changelogs as records of those releases.

Before publishing documentation changes:

- Build the website to check page registration, Markdown, and page links. Check heading fragments too; a successful page-link check does not prove an anchor exists.
- Inspect desktop and mobile navigation, the version switcher, and search on the rendered site.
- Run changed examples with the documented dependencies. For tutorial edits, apply the chapter's changes to the preceding chapter, not only to the finished application.
- Keep old URLs and heading anchors usable when reorganizing content. Update package READMEs and metadata when a package's role changes.

## Pictured samples

A sample whose result is visual shows the window it renders. Keep the sample in a file under `website/figures/` (`guide/` or `tutorial/`), show it on the page with a [snippet import](https://vitepress.dev/guide/markdown#import-code-snippets) such as `<<< @/figures/guide/components-list-view.tsx`, and add it to the `figures` list in `website/figures/capture.test.tsx`. The page then shows the code that was captured.

Give the entry a third element, an options object, when the capture needs more than a render: `before` runs before rendering, for example to seed files the sample reads; `prepare` runs after rendering, for example to wait for content or to narrow the window to the pictured state; `after` cleans up. Give pictured samples the margins a real app would use, so content does not touch the window edge.

A tutorial chapter that spans several files keeps them under `website/figures/tutorial/<chapter>/`, laid out like the reader's project (`src/`, `data/`, `tests/`), so their relative imports match. Later chapters show `diff` blocks against these files, so after changing one, check that each later diff still applies at its stated lines.

Regenerate the images after changing a pictured sample:

```bash
pnpm nx run @gtkx/website:figures
```

The target renders each sample with `@gtkx/testing` in Adwaita's light and dark styles and writes `website/public/figures/<name>-light.png` and `<name>-dark.png` at scale 2. Commit the images: the site build reads them and needs no display. The capture points `HOME`, `XDG_DATA_HOME`, `XDG_CONFIG_HOME` and `XDG_CACHE_HOME` at a temporary directory (`website/figures/setup.ts`), so samples that save data never read or write your own. The website `typecheck` target checks the sample files.

Place the figure where the text says what the reader should see. Its two images follow the site theme, and the caption links the code:

```html
<figure class="result">
    <img class="result-light" src="/figures/<name>-light.png" width="360"
        height="260" alt="…" />
    <img class="result-dark" src="/figures/<name>-dark.png" width="360"
        height="260" alt="…" />
    <figcaption>
        Captured from <a href="#section">the sample</a> above.
    </figcaption>
</figure>
```

Set `width` and `height` to half the PNG's pixel size, and describe the window in `alt`. Keep `class`, `src` and `width` in this order on one line: the site finds them there to link each image wider than 400 to the PNG, so phone readers can open it at full size.

## Brand assets

The mark and the wordmark live in `website/public/`. Use these files instead of setting the name in text next to the mark.

| File                                                | Use                                                                                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gtkx-mark.svg`                                     | The red tile: favicon, app icons, avatars. Never recolor it.                                                                                                          |
| `logo-wordmark-light.svg`, `logo-wordmark-dark.svg` | The mark followed by "GTKX" in Red Hat Display 800, as outlines, for light and dark backgrounds. The site's navigation and footer, the README, and `og.png` use them. |
| `gtkx-glyph.svg`                                    | The orbits without the tile, in `currentColor`, for single-color and small inline uses.                                                                               |
| `og.png`                                            | The social card of every page. Its source is `website/scripts/og.html`; after editing it, run `node website/scripts/og.mjs`, which renders it with a local Chromium.  |

- Leave clear space of at least one orbit width (11/128 of the tile, at least 4px) around the mark.
- Don't set the wordmark in another typeface, in the gradient, or in red.
- Don't place the red tile on a red or photographic background; use the glyph instead.
- Red text uses `--text-brand`, and the large headline accent uses `--gradient-text`, which has a light and a dark value (`website/.vitepress/theme/styles/tokens.css`). Keep `--brand` for the mark, the glow, focus rings, and other non-text accents.

## Documentation versions

[`website/versions.json`](https://github.com/gtkx-org/gtkx/blob/main/website/versions.json) defines each documented version:

| Field         | Purpose                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------ |
| `id`, `label` | Identify the version and label its switcher entry.                                         |
| `prefix`      | Place its guides, tutorial, and reference.                                                 |
| `aliases`     | Retain previous prefixes with static redirects and text downloads.                         |
| `status`      | Mark it as `current`, `prerelease`, or `old`.                                              |
| `examplesRef` | Select the git ref used by the Examples navigation link.                                   |
| `reference`   | Build the API reference from the working tree (`worktree`) or a pinned `tag` and `commit`. |

The manifest drives navigation, sidebars, page mapping between versions, banners, canonical URLs, per-version `llms.txt` and `llms-full.txt`, and TypeDoc output paths.

Exactly one version must use `worktree`; the build rejects any other count. Its empty `label` derives from the version in `packages/create-gtkx/package.json`, which also supplies the prerelease installation command on the landing page. A tag-pinned version records its shipped label and rebuilds from the specified tag and commit, keeping its API reference tied to the release. Each release tag retains one working-tree entry so its own checkout can regenerate that reference when archived.

Between releases, the current version uses the working tree and follows `main`. When adding the next prerelease, make it the working-tree version, pin the outgoing current reference to its release tag and commit, and write its derived label into the manifest.

Reference generation checks the Nx output paths in `website/project.json` against the manifest. A mismatch fails the build because stale paths could restore cached output to the wrong directory. Synchronize declarations after changing prefixes:

```bash
pnpm --filter @gtkx/website reference-sync
```

## Add or move pages

Guide and tutorial pages live under their version's prefix: `website/guide` for the root version and `website/v2/guide` for `/v2`. Register them in `guideGroups` or `tutorialItems` in `website/.vitepress/versioning.ts`. The build rejects unlisted pages so versions cannot silently diverge.

Contributor pages follow `main` independently of releases. Register them in `website/.vitepress/contributing.ts`. They appear in every version's navigation, search, and `llms.txt` exports, and remain at `/contributing/` during promotion.

Keep existing heading anchors when reorganizing a page, or leave links to the moved material. Check links in both rendered pages and generated reference output.

## Promote a prerelease

Complete promotion on the prepared release branch before advancing `main`. That push starts tagging and publishing automatically; the tag must already contain the stable documentation and package READMEs.

1. [Prepare the stable release](/contributing/releases#prepare-a-release) with `specifier=2.0.0`, then check out the resulting `release/next` branch. Confirm that package versions, including `packages/create-gtkx/package.json`, are `2.0.0`; the website derives its working-tree label from that version. Promotion changes documentation placement; it does not bump the release version. For a local rehearsal, run `pnpm prepare-release --specifier 2.0.0` in an isolated checkout instead.
2. Before retiring an existing `old` version, review links to its prefix and aliases, including historical posts. Point those links to a supported guide or a source permalink at the appropriate release tag. Delete the retired version's directories and manifest entry, then run `pnpm --filter @gtkx/website reference-sync`. Promotion refuses to proceed while an old version remains. The outgoing current version must already have a pinned reference tag and commit.
3. Move the current documentation to its archive prefix and the prerelease to the root:

   ```bash
   pnpm --filter @gtkx/website promote-version \
     --to /v1 --examples-ref v2.0.0
   ```

4. Review release copy in the promoted `website/guide`, `website/tutorial`, contributor pages, landing components, the [Releases](/releases) page, root `README.md`, and `packages/*/README.md`. Replace beta installation commands and current-release status text with stable equivalents. Point 2.0 links at the new root paths and 1.x links at `/v1`; retain historical release names in dated posts and changelogs. Archived 1.x installation commands must remain pinned to 1.x. Point the root README's version and Node.js badges at the `latest` dist-tag instead of `beta`, and keep its link to `FUNDING.md`.
5. Review the release's announcement post, `website/blog/gtkx-2-0.md`, which the blog index and sidebar already list. Its date must be the release day, its release-notes link must name the tag being published, and its summary of changes must match the changelog. A release that moves the date updates the post, the blog index and the sidebar together.
6. Regenerate both API references, build the site, and serve the build:

   ```bash
   pnpm nx run @gtkx/website:preview
   ```

   Check the landing links, version switcher, guide and tutorial sidebars, local search, generated references, old page anchors, and each version's `llms.txt` and `llms-full.txt`. The promoted version should be labeled stable, and archived pages should show their old-version banner. Inspect the root and archived Markdown downloads too.

7. Include these changes in the reviewed, signed release-branch history, then follow [Review and advance main](/contributing/releases#review-and-advance-main). A subsequent Release workflow run rebuilds that branch from `main`; it must not discard the reviewed promotion changes.

The script moves each version's `guide`, `tutorial`, and `reference` directories, updates `versions.json`, and synchronizes the Nx reference output paths. It rewrites absolute documentation links in website Markdown by the version they target, preserving intentional links between versions. Prerelease guides and tutorial chapters link to examples and tutorial sources on `main`; the script pins those `tree/main` and `blob/main` links in the promoted version's pages to `--examples-ref`, which also becomes its `examplesRef`, so the stable pages keep pointing at the release they document. It does not rewrite beta prose or package commands, such as Getting Started's note that the tutorial follows `main`, and it does not edit files outside `website/`. Generated reference links are corrected by regeneration.

Promotion keeps the new current reference on `worktree`. Pinning it now would leave no working-tree version; wait until adding the next prerelease, as described above.

Promotion records the former prerelease prefix in the version's `aliases`. The production build emits static redirects for its guide, tutorial, and reference pages, preserving URL queries and heading fragments. It also copies Markdown downloads and `llms` exports under that prefix. Aliases stay out of navigation, search, and the sitemap; their canonical URLs point to the version's current pages. They follow the version when it is archived and disappear when its manifest entry is retired.

An old page uses the current version's corresponding page as its canonical URL when that page exists. Otherwise it keeps its own canonical URL, including reference pages for removed symbols.
