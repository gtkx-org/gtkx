# Tutorial checkpoints

The generator reconstructs all 18 chapters for v2 and stable 1.6 directly from the tutorial's named code fences. Full files, patches, appended declarations, and package metadata come from the pages; there are no separate application snapshots to keep synchronized.

| Step | Chapter | Command argument |
| --- | --- | --- |
| 1 | Create a Window | `your-first-window` |
| 2 | Display Tasks | `a-list-of-tasks` |
| 3 | Add Tasks | `the-task-store` |
| 4 | Complete, Star, and Delete Tasks | `completing-and-deleting` |
| 5 | Save Tasks | `saving-to-disk` |
| 6 | Add Lists and a Sidebar | `lists-and-the-sidebar` |
| 7 | Adapt the Layout | `an-adaptive-layout` |
| 8 | Filter and Search Tasks | `smart-views-and-search` |
| 9 | Edit Tasks | `the-task-editor` |
| 10 | Add Menus and Shortcuts | `actions-menus-shortcuts` |
| 11 | Add Undo and Delete Confirmation | `trash-and-toasts` |
| 12 | Add Preferences | `preferences-and-theming` |
| 13 | Reorder Tasks | `drag-to-reorder` |
| 14 | Send Reminders | `reminders` |
| 15 | Test the App | `testing` |
| 16 | Package the App | `packaging` |
| 17 | Translate the App | `internationalization` |
| 18 | Prepare for Flathub | `flatpak` |

From a GTKX checkout, create a stable checkpoint in a new directory:

```bash
pnpm tutorial:checkpoints --version v1 --chapter the-task-store --output /tmp/gtkx-tasks
cd /tmp/gtkx-tasks
npm install
npm test
npm run dev
```

`--version v1` pins GTKX to 1.6.0. The default is `v2`, using the GTKX version declared by the current example. Other dependency ranges come from the corresponding example manifest. Keep the generated lockfile for repeatable dependency resolution. The default final chapter is `flatpak`; `--chapter` includes all preceding edits. Existing output directories are rejected.

The published v2 beta.10 supports chapters 1–9. The remaining v2 chapters use APIs from the working repository that have not yet been published. After [setting up the repository](../../../CONTRIBUTING.md), build and install those packages through the local registry:

```bash
pnpm tutorial run typecheck
pnpm tutorial:checkpoints --check --dependencies examples/tutorial/node_modules --chapter your-first-window --output /tmp/gtkx-tasks-v2
cd /tmp/gtkx-tasks-v2
npm run dev
```

The first command leaves the example's installed dependencies available for the second. `--dependencies` copies that directory, including development and transitive dependencies, into the checkpoint. It does not validate a registry installation. Use an installation from the matching GTKX version; a stable dependency tree cannot check v2 APIs. The source files still come entirely from the tutorial.

## Replay the progression

```bash
pnpm tutorial:checkpoints --check --version v1
pnpm tutorial:checkpoints --check --dependencies examples/tutorial/node_modules
```

Without `--dependencies`, the check installs packages from the configured npm registry into a fresh temporary project, adding chapter dependencies as they appear. With a current development registry, use its npm configuration and a fresh cache to keep unpublished packages distinct from published packages with the same version.

Every chapter is applied to its predecessor, typechecked, built, and started under a headless display. Add Tasks introduces three integration checks. Test the App expands coverage to 31 native workflows; Translate the App adds three French checks. From each introduction onward, the check runs that suite at every checkpoint. App startup uses an isolated data directory and in-memory settings; test setup isolates its own data.

Add `--output /tmp/gtkx-tasks` to retain the generated project and lockfile for inspection. `--from testing --chapter internationalization` reconstructs earlier chapters but runs checks only for the selected range. It is useful for investigating a failure; it does not verify the skipped chapters.

The runner copies the example's TypeScript setup, test scaffold, icons, and license alongside the documented files. These supporting files are shared with the finished example. It removes the temporary project after a check unless `--output` was supplied.

## Packaging checks

`--check` validates the app and its tests, including the final source-mode configuration. It does not install packages, publish to Flathub, or fetch the placeholder source repository. Follow Package the App and Prepare for Flathub to inspect the produced packages and run their installed launchers.

Use `--chapter internationalization` for the localized app's prebuilt packaging configuration. The final `flatpak` checkpoint switches to source mode and includes a repository URL that you must replace with your own before building that manifest.

## Maintain the checkpoints

Use a fence title such as `tsx [src/app.tsx]` for a complete file or `diff [src/app.tsx]` for a unified patch. `append` adds declarations to an existing file; JSON `merge` updates top-level fields and merges their immediate object values. Unnamed illustrative snippets are not extracted. Keep every required edit in a named fence and replay both versions after changing a shared step.
