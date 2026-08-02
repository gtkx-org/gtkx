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
- **advanced**, **input**, **drawing**, **media**, **navigation**, **benchmark**, and **games** cover text rendering and font features, entries and text views, drawing areas and paintables, video playback, stacks and revealers, and a minesweeper.

The shell around them uses `Menu` and `Dialog` from `@gtkx/components`, `@gtkx/css` for styling, portals for demos that open their own windows, and a `GSimpleAction` set wired to a menu and shortcut controller. `tests/` exercises the app with `@gtkx/testing`.

`gtkx.config.ts` declares `Gtk-4.0`, `Adw-1`, and `GtkSource-5`, with the application ID `org.gtkx.gtk-demo`. The GtkSourceView 5 development package must be installed; see [CONTRIBUTING.md](../../CONTRIBUTING.md#system-dependencies).

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
