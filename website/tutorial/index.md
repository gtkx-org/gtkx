---
description: "Build Tasks, a Linux task manager, one running step at a time, and ship it as a Flatpak."
---

# Build a Tasks App with GTKX

<picture>
  <source srcset="/tasks-screenshot.webp" type="image/webp" />
  <img src="/tasks-screenshot.png" width="900" height="600" loading="lazy" alt="The Tasks app: an adaptive Adwaita window with a sidebar of smart views and colored user lists on the left, and a boxed task list on the right." />
</picture>

Build **Tasks**, a Linux task manager, from an empty directory to localized Flatpak, deb, rpm, and AppImage packages. You will add adaptive layouts, settings, keyboard shortcuts, dialogs, notifications, and translations, then prepare the app for Flathub.

Each chapter ends with a running app and a check of the feature you added.

The tutorial assumes familiarity with [React](https://react.dev/learn) and [TypeScript](https://www.typescriptlang.org/docs/handbook/2/basic-types.html). It focuses on using GTKX with libadwaita and GTK4. You need Linux, the native development libraries, and Node.js 24 or later; [Getting Started](/guide/getting-started) covers installation.

## Check your setup

Confirm that Node.js is version 24 or later:

```bash
node --version
```

Scaffold the project:

::: code-group

```bash [npm]
npm create gtkx@1.6.0
```

```bash [pnpm]
pnpm create gtkx@1.6.0
```

```bash [yarn]
yarn create gtkx@1.6.0
```

:::

Choose `tasks` as the project directory and `com.gtkx.tutorial` as the application ID. Enable TypeScript and the testing setup, then choose your package manager. The scaffolder installs dependencies and initializes a Git repository.

The commands below use npm; use the equivalent commands for your package manager. If you choose another application ID, substitute it consistently throughout the tutorial.

Start the app:

```bash
cd tasks
npm run dev
```

This opens the stable initializer's small GTK counter. The next chapter enables Adwaita and replaces it with the standard Adwaita application shell used for the rest of the tutorial.

Leave `npm run dev` running as you work. Fast Refresh applies component edits to the open window; changes that need a restart relaunch the app. Saving `gtkx.config.ts` regenerates bindings and relaunches it too.

## How this tutorial works

Follow the chapters in order. Each adds a feature and ends with a **Run it** section to check the result in the running app.

Examples name the file to edit. A complete-file example replaces that file. A `diff` block shows removed lines with `-` and added lines with `+`; apply its changes to the existing file. An `append` block adds declarations at the end, and a JSON `merge` block updates the named fields. Keep the surrounding code unless instructed otherwise. Run `npm run typecheck` after each chapter and `npm test` once Add Tasks introduces the suite.

After the **Run it** checks pass, save a commit in your project so you can review the next chapter's changes with `git diff` or return to a working state. Keep the lockfile with that commit.

The [completed 1.6 source](https://github.com/gtkx-org/gtkx/tree/v1.6.0/examples/tutorial) provides a reference for the finished app. It includes later features, so copy only the change a chapter describes when following along.

## Chapter checkpoints

The [checkpoint generator](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial/checkpoints) reconstructs all 18 stable chapters from these examples. From a current GTKX repository checkout:

```bash
pnpm tutorial:checkpoints --version v1 --chapter the-task-store --output /tmp/gtkx-tasks
cd /tmp/gtkx-tasks
npm install
npm test
npm run dev
```

Use a new output directory. `--version v1` selects the stable pages and GTKX 1.6.0 dependencies. Add `--check` to install dependencies and typecheck, build, start, and test every checkpoint up to the selected chapter. Continue to use each chapter's **Run it** checks to inspect the interaction.

## Next

Continue to [Create a Window](/tutorial/your-first-window).
