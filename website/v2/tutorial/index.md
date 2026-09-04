---
description: "Build Tasks, a GNOME task manager, one running step at a time, and ship it as a Flatpak."
---

# Build a Tasks App with GTKX

<picture>
  <source srcset="/tasks-screenshot.webp" type="image/webp" />
  <img src="/tasks-screenshot.png" width="900" height="600" loading="lazy" alt="The Tasks app: an adaptive Adwaita window with a sidebar of smart views and colored user lists on the left, and a boxed task list on the right." />
</picture>

That is **Tasks**, a GNOME task manager. In this tutorial you build it from an empty directory to a set of localized Flatpak, deb, rpm, and AppImage packages, then prepare it for Flathub. Along the way you cover the pieces every GNOME app is made of: adaptive layout, settings, actions and accelerators, dialogs, desktop notifications that keep working after the app closes, and gettext catalogs behind the actual react-i18next API.

You build it one running step at a time: after every chapter you have an app you can launch.

You need working familiarity with [React](https://react.dev/learn) and [TypeScript](https://www.typescriptlang.org/docs/handbook/2/basic-types.html), which this tutorial does not teach: it spends its words on GTK4 and Adwaita instead. You also need Linux with the GTK4 development libraries and Node.js 26.7 or later. [Getting Started](/v2/guide/getting-started) covers what to install.

## Check your setup

Check your Node.js version:

```bash
node --version
```

You should see 26.7 or later:

```
v26.7.0
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

Answer the prompts like this:

```
┌  Create GTKX App
│
◇  Project directory
│  tasks
│
◇  Display name
│  Tasks
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

The application ID takes reverse-DNS form. Changing it later orphans every setting a user has saved, so pick one you can live with. If you use your own, substitute it consistently from here on.

Start the app:

```bash
cd tasks
npm run dev
```

This opens a small window with a counter in it, which the next chapter replaces.

Keep this `npm run dev` running for the whole tutorial. Saving a `.ts` or `.tsx` file patches the running widget tree through Fast Refresh, so a `## Run it` section means save and look at the open window. Saving `gtkx.config.ts` regenerates bindings and relaunches the app for you.

## How this tutorial works

Every chapter names a capability, adds it to an app that already runs, and ends with a `## Run it` section stating exactly what you should see. If you do not see it, something went wrong in that chapter, not an earlier one.

Every code block carries its file path in the sentence directly above it. Edits to a file you already have appear as partials, with `// ...` standing in for lines you leave alone. No code block ever depends on a chapter you have not read yet.

## Scope

GNOME To Do is a mature application, and Tasks is smaller. What they share is the platform: the same GTK4 widgets, the same Adwaita patterns, the same settings, actions, and notifications. Finishing this tutorial leaves you able to open the To Do source and recognize what you see.

## Next

Continue to [Your First Window](/v2/tutorial/your-first-window).
