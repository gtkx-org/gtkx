# gtk-demo

A React port of [gtk4-demo](https://gitlab.gnome.org/GNOME/gtk/-/tree/main/demos/gtk-demo), the official GTK4 widget showcase. A searchable sidebar lists the demos by category, the Info tab describes the selected one, and the Source tab renders its source in a `GtkSourceView` with syntax highlighting.

## What it demonstrates

The demos live under `src/demos`, grouped by category:

- **lists**: `GtkListView` and `GtkListBox`, selection models, filtering, sorting, and a file browser.
- **css**: style classes, blend modes, shadows, multiple backgrounds, and error states.
- **layout**: constraints (including the VFL syntax), `GtkFixed`, `GtkFlowBox`, `GtkPaned`, size groups, and header bars.
- **dialogs**: file and font pickers, printing, and page setup.
- **gestures**: drag and drop, clipboard, cursors, and shortcut triggers.
- **opengl**: `@gtkx/gl` driving `GtkGLArea`, with gears and a Shadertoy player.
- **drawing**: `@gtkx/cairo` behind `GtkDrawingArea`, plus images and an SVG paintable.
- **advanced**, **input**, **media**, **navigation**, **benchmark**, and **games** cover text rendering and font features, entries and text views, video playback, stacks and revealers, and a minesweeper.

The shell around them uses `ListView` from `@gtkx/components` for the sidebar, a `GtkWindow` for demos that open their own window, and a `GSimpleAction` set wired to a `GMenu` and a `GtkShortcutController`. `tests/` exercises the app with `@gtkx/testing`.

`gtkx.config.ts` adds `GtkSource-5` to the default GTK and Adwaita bindings. The GtkSourceView 5 development package must be installed; see [CONTRIBUTING.md](../../CONTRIBUTING.md#system-dependencies).

## Run it

Install and build the workspace once from the repository root, then:

```sh
pnpm --filter gtk-demo dev
```

Its tests are part of the workspace suite and run from the repository root with `pnpm vitest run --project gtk-demo`. For coverage, use `pnpm --filter gtk-demo coverage`.

## Learn more

- [Components](https://gtkx.dev/guide/components)
- [CSS](https://gtkx.dev/guide/css)
- [Modals and Portals](https://gtkx.dev/guide/modals-and-portals)
- [Testing](https://gtkx.dev/guide/testing)
