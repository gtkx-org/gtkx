---
description: "Build a Markdown notes app for Linux with React and Adwaita, then test, translate, and package it."
---

# Build a Notes App with GTKX

<img src="/notes-screenshot.png" width="960" height="640" loading="lazy" alt="The Notes app: an Adwaita window with a list of notes on the left and a note rendered as Markdown on the right." />

Build **Notes**, a Markdown notes app that keeps each note as a plain file in a folder, from an empty directory, then test, translate, and package it as a Flatpak, deb, rpm, and AppImage. You will use npm packages, Node's file APIs and a worker thread, GtkSourceView (a library outside the default bindings), a GObject interface written in TypeScript, and Fast Refresh, Storybook and MCP, then prepare the app for Flathub.

The tutorial assumes familiarity with [React](https://react.dev/learn) and [TypeScript](https://www.typescriptlang.org/docs/handbook/2/basic-types.html). It focuses on using GTKX with libadwaita and GTK 4. You need Linux, the native development libraries, and Node.js 26.7 or later; [Getting Started](/v2/guide/getting-started) covers installation. Notes also needs GtkSourceView 5 with its GObject introspection data, and the gettext tools.

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

Choose `notes` as the project directory, keep the suggested package name, and enter **Notes** as the display name and `dev.gtkx.Notes` as the application ID. Choose your package manager, and enable TypeScript and the testing setup. The scaffolder installs the dependencies and makes a first Git commit.

The commands below use npm; use the equivalent commands for your package manager. If you choose another application ID, substitute it consistently throughout the tutorial.

Start the app:

```bash
cd notes
npm run dev
```

This opens an Adwaita window with a counter. The next chapter replaces it with the Notes window.

Leave `npm run dev` running as you work. It applies saved edits to the open window and relaunches the app when an edit needs a restart; saving `gtkx.config.ts` also regenerates the bindings. [Develop with Fast Refresh](/v2/tutorial/fast-refresh) shows which edits keep the app's state.

## How this tutorial works

Follow the chapters in order. Each one leaves the app runnable and ends with **Run it** checks to try in the running app.

| Stage                   | Chapters                                                                                                         | What you build                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Foundation              | [Create a Window](/v2/tutorial/your-first-window) through [Develop with Fast Refresh](/v2/tutorial/fast-refresh) | A Markdown editor and preview over a folder of plain files                     |
| Desktop features        | [Adapt the Layout](/v2/tutorial/an-adaptive-layout) through [Complete Note Links](/v2/tutorial/note-links)       | An adaptive layout, search, tags, menus, dialogs, preferences, link completion |
| Develop, test, and ship | [Develop the Preview in Storybook](/v2/tutorial/storybook) through [Prepare for Flathub](/v2/tutorial/flatpak)   | Stories, integration tests, MCP, translations, and installable packages        |

Examples you apply are titled with their file. Most show the whole file: create it or replace yours with it, and the highlighted lines are the ones the chapter adds or changes. A short block, such as a few `package.json` fields or one `gtkx.config.ts` option, shows only what to add; keep the rest of the file. Run `npm run typecheck` after each chapter and `npm test` once [Test the App](/v2/tutorial/testing) adds the suite.

After the **Run it** checks pass, save a commit in your project so you can review the next chapter's changes with `git diff` or return to a working state. Keep the lockfile with that commit.

The [finished source](https://github.com/gtkx-org/gtkx/tree/main/tutorial) is a reference for the complete app. It includes later features, so copy only the change a chapter describes when following along.
