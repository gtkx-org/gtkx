---
description: "Build a Markdown notes app for Linux with React and Adwaita, then test, translate, and package it."
---

# Build a Notes App with GTKX

<img src="/notes-screenshot.png" width="960" height="640" loading="lazy" alt="The Notes app: an Adwaita window with a list of notes on the left and a note rendered as Markdown on the right." />

Build **Notes**, a Markdown notes app that keeps each note as a plain file in a folder, from an empty directory, then test, translate, and package it as a Flatpak, deb, rpm, and AppImage. You will use npm packages, Node's file APIs and a worker thread, a library beyond the default bindings, a GObject interface written in TypeScript, and Fast Refresh, Storybook and MCP, then prepare the app for Flathub.

::: info Being written
The 2.0 tutorial is moving from Tasks to Notes. Chapters marked "being written" show their plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

Each chapter keeps the app runnable and includes checks for the feature you added.

The tutorial assumes familiarity with [React](https://react.dev/learn) and [TypeScript](https://www.typescriptlang.org/docs/handbook/2/basic-types.html). It focuses on using GTKX with libadwaita and GTK4. You need Linux, the native development libraries, and Node.js 26.7 or later; [Getting Started](/v2/guide/getting-started) covers installation. Notes also needs GtkSourceView 5 with its GObject introspection data, and the gettext tools.

This tutorial uses the GTKX 2.0 beta. Keep GTKX packages on the same version; [`gtkx upgrade`](/v2/guide/updating) moves them together. For the stable release, use the [1.6 tutorial](/tutorial/), which builds a task manager.

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

Choose `notes` as the project directory, **Notes** as the display name, and `dev.gtkx.Notes` as the application ID. Enable TypeScript and the testing setup, and choose your package manager. The scaffolder installs the dependencies and initializes a Git repository. `yarn create` cannot run the prerelease scaffolder; to manage the project with Yarn, start it with npm or pnpm and choose Yarn as the package manager.

The commands below use npm; use the equivalent commands for your package manager. If you choose another application ID, substitute it consistently throughout the tutorial.

Start the app:

```bash
cd notes
npm run dev
```

This opens an Adwaita window with a counter. The next chapter replaces it with the Notes window.

Leave `npm run dev` running as you work. Fast Refresh applies edits to components, and to the hooks and styles they import, to the open window; changes that need a restart relaunch the app. Saving `gtkx.config.ts`, or a local file it imports, regenerates bindings and relaunches it too.

## How this tutorial works

Follow the chapters in order. Use each chapter's checks to confirm the result in the running app.

| Stage                   | Chapters                                                                                                         | What you build                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Foundation              | [Create a Window](/v2/tutorial/your-first-window) through [Develop with Fast Refresh](/v2/tutorial/fast-refresh) | A Markdown editor and preview over a folder of plain files                     |
| Desktop features        | [Adapt the Layout](/v2/tutorial/an-adaptive-layout) through [Complete Note Links](/v2/tutorial/note-links)       | An adaptive layout, search, tags, menus, dialogs, preferences, link completion |
| Develop, test, and ship | [Develop the Preview in Storybook](/v2/tutorial/storybook) through [Prepare for Flathub](/v2/tutorial/flatpak)   | Stories, integration tests, MCP, translations, and installable packages        |

Examples name the file to edit. A complete-file example replaces that file. A `diff` block shows removed lines with `-` and added lines with `+`; apply its changes to the existing file. A JSON `merge` block updates the named fields. Keep the surrounding code unless instructed otherwise. Run `npm run typecheck` after each chapter and `npm test` once [Test the App](/v2/tutorial/testing) adds the suite.

After the **Run it** checks pass, save a commit in your project so you can review the next chapter's changes with `git diff` or return to a working state. Keep the lockfile with that commit.

The [finished source](https://github.com/gtkx-org/gtkx/tree/main/tutorial) is a reference for the complete app. It includes later features, so copy only the change a chapter describes when following along.
