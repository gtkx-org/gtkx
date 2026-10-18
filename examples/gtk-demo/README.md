# GTK Demo

An Adwaita-based, searchable React port of [gtk4-demo](https://gitlab.gnome.org/GNOME/gtk/-/tree/main/demos/gtk-demo). It places GTK collections, CSS, layouts, dialogs, gestures, OpenGL, Cairo, media, text, navigation, and actions inside an Adwaita application shell.

Follow the [workspace setup](../../CONTRIBUTING.md#set-up-the-workspace). This demo requires GTK 4.22 or later for SVG widgets and the GtkSourceView 5 development package. Then run from the repository root:

```bash
pnpm --filter gtk-demo dev
```

See the [GTKX guides](https://gtkx.dev/v2/guide/components) and the demos under `src/demos`.

## Media troubleshooting

The Images demo enables looping on a shared media stream. GStreamer's native teardown race is tracked in [#758](https://github.com/gtkx-org/gtkx/issues/758); a fix in supported GStreamer releases has not been verified. See the [Images implementation](src/demos/drawing/images.tsx) for its current playback and cleanup behavior.
