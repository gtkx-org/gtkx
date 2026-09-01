# gtk-demo

A searchable React port of [gtk4-demo](https://gitlab.gnome.org/GNOME/gtk/-/tree/main/demos/gtk-demo). It exercises GTK collections, CSS, layouts, dialogs, gestures, OpenGL, cairo, media, text, navigation, and actions through real application workflows.

Install the GtkSourceView 5 development package, then run from the repository root:

```bash
pnpm --filter gtk-demo dev
pnpm vitest run --project gtk-demo
```

See the [GTKX guides](https://gtkx.dev/guide/components) and the demos under `src/demos`.
