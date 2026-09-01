---
title: "Tutorial: Build Tasks"
description: "Build and ship a small native GTKX task manager in six focused steps."
---

# Build Tasks

This tutorial builds **Tasks**, a native task manager with persistence, adaptive navigation, forms, actions, localization, tests, and Linux packages. The finished application lives in [`examples/tutorial`](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial).

Use the tutorial to understand how the pieces fit together. Use the [guides](/guide/getting-started) for focused workflows and the [API reference](/reference/) for signatures and options.

## Create the project

GTKX requires Linux, Node.js 26.7 or newer, and the GTK4, Adwaita, and GLib development packages.

```bash
npm create gtkx -- tasks --yes --application-id com.gtkx.tutorial
cd tasks
npm run dev
```

The scaffold supplies the configuration, generated imports, Vitest setup, and a counter window. Replace the counter with the application shell:

```tsx
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";

const App = () => (
    <AdwApplication>
        <AdwApplicationWindow title="Tasks" defaultWidth={900} defaultHeight={640} onCloseRequest={quit}>
            <GtkLabel label="No tasks yet" />
        </AdwApplicationWindow>
    </AdwApplication>
);

createRoot().render(<App />);
```

GTKX elements come from `@gtkx/jsx/<namespace>`. Classes, enums, and functions come from `@gtkx/gi/<namespace>`. Children describe containment, signals are `on*` props, and a `ref` exposes the native instance.

## Work through the app

1. [Store tasks and save them](/tutorial/the-task-store).
2. [Add adaptive navigation and the editor](/tutorial/an-adaptive-layout).
3. [Wire actions, settings, notifications, and translations](/tutorial/actions-menus-shortcuts).
4. [Test workflows through the UI](/tutorial/testing).
5. [Package and publish the application](/tutorial/packaging).

Keep `npm run dev` open while you work. Fast Refresh updates the mounted tree; changes to process-level setup restart the application.
