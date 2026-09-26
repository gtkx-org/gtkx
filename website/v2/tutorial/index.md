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

The tutorial assumes familiarity with [React](https://react.dev/learn) and [TypeScript](https://www.typescriptlang.org/docs/handbook/2/basic-types.html). It focuses on using GTKX with libadwaita and GTK4. You need Linux, the native development libraries, and Node.js 26.7 or later; [Getting Started](/v2/guide/getting-started) covers installation.

::: warning Development version
This tutorial follows the working v2 code. Published beta.10 supports the first nine chapters; later chapters use APIs that are not yet published. Use the repository workflow below for the complete tutorial, or follow the [stable 1.6 tutorial](/tutorial/) with registry packages.
:::

## Check your setup

Confirm that Node.js is version 26.7 or later:

```bash
node --version
```

Scaffold the project:

::: code-group

```bash [npm]
npm create gtkx@beta
```

```bash [pnpm]
pnpm create gtkx@beta
```

```bash [yarn]
yarn create gtkx@beta
```

:::

Choose `tasks` as the project directory, **Tasks** as the display name, and `com.gtkx.tutorial` as the application ID. Enable TypeScript and the testing setup, and choose your package manager. The scaffolder installs the dependencies and initializes a Git repository.

The commands below use npm; use the equivalent commands for your package manager. If you choose another application ID, substitute it consistently throughout the tutorial.

Start the app:

```bash
cd tasks
npm run dev
```

This opens an Adwaita window with a counter. The next chapter replaces it with the Tasks application shell.

Leave `npm run dev` running as you work. Fast Refresh applies component edits to the open window; changes that need a restart relaunch the app. Saving `gtkx.config.ts`, or a local file it imports, regenerates bindings and relaunches it too.

## How this tutorial works

Follow the chapters in order. Each adds a feature and ends with a **Run it** section to check the result in the running app.

Examples name the file to edit. A complete-file example replaces that file. A `diff` block shows removed lines with `-` and added lines with `+`; apply its changes to the existing file. An `append` block adds declarations at the end, and a JSON `merge` block updates the named fields. Keep the surrounding code unless instructed otherwise. Run `npm run typecheck` after each chapter and `npm test` once Add Tasks introduces the suite.

After the **Run it** checks pass, save a commit in your project so you can review the next chapter's changes with `git diff` or return to a working state. Keep the lockfile with that commit.

## Use the repository build

Complete the [contributor setup](/contributing/), then run these commands from the GTKX checkout:

```bash
pnpm tutorial run typecheck
pnpm tutorial:checkpoints --check --dependencies examples/tutorial/node_modules --chapter your-first-window --output /tmp/gtkx-tasks
cd /tmp/gtkx-tasks
npm run dev
```

The first command builds and installs the current packages through a temporary local registry. The checkpoint command copies those dependencies into a new project and reconstructs the first chapter from its examples. Start with that project to follow the complete tutorial. The first chapter explains its application shell.

## Chapter checkpoints

The [checkpoint generator](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial/checkpoints) reconstructs every chapter from the named code fences. Select the chapter slug with `--chapter` and a new directory with `--output`. For current v2 code, retain `--check --dependencies examples/tutorial/node_modules` from the command above.

The check applies chapters in order, typechecks, builds, starts each app, and runs the tests available at that step. It does not replace the chapter's **Run it** checks or install a built package. The [finished source](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial) is a separate reference for the complete app.

## Next

Continue to [Create a Window](/v2/tutorial/your-first-window).
