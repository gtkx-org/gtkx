---
description: "Build a Linux task manager with React and Adwaita, then test, translate, and package it."
---

# Build a Tasks App with GTKX

<picture>
  <source srcset="/tasks-screenshot.webp" type="image/webp" />
  <img src="/tasks-screenshot.png" width="900" height="600" loading="lazy" alt="The Tasks app: an adaptive Adwaita window with a sidebar of smart views and colored user lists on the left, and a boxed task list on the right." />
</picture>

Build **Tasks**, a Linux task manager, from an empty directory, then test, translate, and package it as a Flatpak, deb, rpm, and AppImage. You will add adaptive layouts, settings, keyboard shortcuts, dialogs, notifications, and translations, then prepare the app for Flathub.

Each chapter keeps the app runnable and includes checks for the feature you added.

The tutorial assumes familiarity with [React](https://react.dev/learn) and [TypeScript](https://www.typescriptlang.org/docs/handbook/2/basic-types.html). It focuses on using GTKX with libadwaita and GTK4. You need Linux, the native development libraries, and Node.js 26.7 or later; [Getting Started](/v2/guide/getting-started) covers installation.

This tutorial uses the GTKX 2.0 beta. Keep GTKX packages on the same version. For the stable release, use the [1.6 tutorial](/tutorial/).

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

:::

Choose `tasks` as the project directory, **Tasks** as the display name, and `com.gtkx.tutorial` as the application ID. Enable TypeScript and the testing setup, and choose your package manager. The scaffolder installs the dependencies and initializes a Git repository. `yarn create` cannot run the prerelease scaffolder; to manage the project with Yarn, start it with npm or pnpm and choose Yarn as the package manager.

The commands below use npm; use the equivalent commands for your package manager. If you choose another application ID, substitute it consistently throughout the tutorial.

Start the app:

```bash
cd tasks
npm run dev
```

This opens an Adwaita window with a counter. The next chapter replaces it with the Tasks application shell.

Leave `npm run dev` running as you work. Fast Refresh applies component edits to the open window; changes that need a restart relaunch the app. Saving `gtkx.config.ts`, or a local file it imports, regenerates bindings and relaunches it too.

## How this tutorial works

Follow the chapters in order. Use each chapter's checks to confirm the result in the running app.

| Stage                  | Chapters                                                                                                         | What you build                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Foundation             | [Create a Window](/v2/tutorial/your-first-window) through [Save Tasks](/v2/tutorial/saving-to-disk)              | A task list with controls and persistent storage             |
| Navigation and editing | [Add Lists and a Sidebar](/v2/tutorial/lists-and-the-sidebar) through [Edit Tasks](/v2/tutorial/the-task-editor) | An adaptive layout, search, and task editor                  |
| Desktop features       | [Add Menus and Shortcuts](/v2/tutorial/actions-menus-shortcuts) through [Send Reminders](/v2/tutorial/reminders) | Actions, dialogs, preferences, reordering, and notifications |
| Test and distribute    | [Test the App](/v2/tutorial/testing) through [Prepare for Flathub](/v2/tutorial/flatpak)                         | Integration tests, translations, and installable packages    |

Examples name the file to edit. A complete-file example replaces that file. A `diff` block shows removed lines with `-` and added lines with `+`; apply its changes to the existing file. A JSON `merge` block updates the named fields. Keep the surrounding code unless instructed otherwise. Run `npm run typecheck` after each chapter and `npm test` once Add Tasks introduces the suite.

After the **Run it** checks pass, save a commit in your project so you can review the next chapter's changes with `git diff` or return to a working state. Keep the lockfile with that commit.

The [finished source](https://github.com/gtkx-org/gtkx/tree/main/tutorial) is a reference for the complete app. It includes later features, so copy only the change a chapter describes when following along.

## Next

Continue to [Create a Window](/v2/tutorial/your-first-window).
