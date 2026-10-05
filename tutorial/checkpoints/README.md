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

The published v2 beta.10 supports chapters 1–9. The remaining v2 chapters use APIs from the working repository that have not yet been published. After [setting up the repository](../../CONTRIBUTING.md), build and publish those packages through the local registry in one terminal:

```bash
pnpm local-registry
```

Keep that registry running. In another terminal, from the repository root, generate a checkpoint and install it against the registry:

```bash
pnpm tutorial:checkpoints --chapter your-first-window --output /tmp/gtkx-tasks-v2
cd /tmp/gtkx-tasks-v2
NPM_CONFIG_REGISTRY=http://127.0.0.1:4873 NPM_CONFIG_CACHE="$(mktemp -d)" npm install
npm run typecheck
npm run dev
```

The generator writes source files reconstructed from the tutorial. Install current packages from the local registry with a fresh npm cache, then run the generated application's commands. Keep the registry running when installing later chapter dependencies, and use the same registry setting for those installs.

## Validate the progression

Run the tutorial's Vitest suite through Nx:

```bash
pnpm nx run @gtkx/e2e:e2e -- tests/tutorial.test.ts
```

The suite prepares its own registry, validates a temporary copy of the finished application, and replays every v2 chapter with those installed dependencies. Stop a manual registry before running it. Checkpoint validation belongs to this suite; the generator accepts only `--version`, `--chapter`, and `--output`.

Each chapter is applied to its predecessor, typechecked, built, and started under a headless display. Tests introduced by a chapter run at that checkpoint and each later one. App startup uses an isolated data directory and in-memory settings; test setup isolates its own data. Vitest removes the temporary applications afterward.

For interactive inspection of either version, generate a selected chapter into a new output directory, install its dependencies, and run its application commands as shown above. The generator includes the example's TypeScript setup, test scaffold, icons, and license alongside the documented files. These supporting files are shared with the finished example.

## Packaging checks

The Vitest suite validates the finished application's localized packages and every v2 checkpoint, including the final source-mode configuration. It does not publish to Flathub or fetch the placeholder source repository. Follow Package the App and Prepare for Flathub to inspect the produced packages and run their installed launchers.

Use `--chapter internationalization` when generating the localized app's prebuilt packaging configuration. The final `flatpak` checkpoint switches to source mode and includes a repository URL that you must replace with your own before building that manifest.

## Maintain the checkpoints

Use a fence title such as `tsx [src/app.tsx]` for a complete file or `diff [src/app.tsx]` for a unified patch. `append` adds declarations to an existing file; JSON `merge` updates top-level fields and merges their immediate object values. Unnamed illustrative snippets are not extracted. Keep every required edit in a named fence. After changing a shared step, run the v2 Vitest suite and generate and inspect the affected stable checkpoints.
