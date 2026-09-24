---
description: "Build Tasks, a GNOME task manager, one running step at a time, and ship it as a Flatpak."
---

# Build a Tasks App with GTKX

<picture>
  <source srcset="/tasks-screenshot.webp" type="image/webp" />
  <img src="/tasks-screenshot.png" width="900" height="600" loading="lazy" alt="The Tasks app: an adaptive Adwaita window with a sidebar of smart views and colored user lists on the left, and a boxed task list on the right." />
</picture>

Build **Tasks**, a GNOME task manager, from an empty directory to localized Flatpak, deb, rpm, and AppImage packages. You will add adaptive layouts, settings, keyboard shortcuts, dialogs, notifications, and translations, then prepare the app for Flathub.

You build it one running step at a time: after every chapter you have an app you can launch.

The tutorial assumes familiarity with [React](https://react.dev/learn) and [TypeScript](https://www.typescriptlang.org/docs/handbook/2/basic-types.html). It focuses on using GTKX with libadwaita and GTK4. You need Linux, the native development libraries, and Node.js 24 or later; [Getting Started](/guide/getting-started) covers installation.

## Check your setup

Confirm that Node.js is version 24 or later:

```bash
node --version
```

Scaffold the project:

::: code-group

```bash [npm]
npm create gtkx
```

```bash [pnpm]
pnpm create gtkx
```

```bash [yarn]
yarn create gtkx
```

:::

Answer the prompts like this:

```
┌  Create GTKX App
│
◇  Project directory
│  tasks
│
◇  Application ID
│  com.gtkx.tutorial
│
◇  Package manager
│  npm
│
◇  Use TypeScript?
│  Yes
│
◇  Include testing setup (Vitest)?
│  Yes
│
```

It then writes the project, installs the dependencies, initializes a git repository, and prints the commands to start it.

Pick whichever package manager you use. This tutorial writes `npm run` in its commands; substitute freely.

Use `com.gtkx.tutorial` for the application ID, or substitute your own consistently. Later chapters use it for settings, desktop integration, and packaging.

Start the app:

```bash
cd tasks
npm run dev
```

This opens the stable initializer's small GTK counter. The next chapter enables Adwaita and replaces it with the standard Adwaita application shell used for the rest of the tutorial.

Leave `npm run dev` running as you work. Fast Refresh applies component edits to the open window; changes that need a restart relaunch the app. Saving `gtkx.config.ts` regenerates bindings and relaunches it too.

## How this tutorial works

Follow the chapters in order. Each adds a feature and ends with a **Run it** section to check the result in the running app.

Examples name the file to edit. Partial snippets omit code from earlier steps; keep that surrounding code unless instructed to replace it.

## Next

Continue to [Your First Window](/tutorial/your-first-window).
