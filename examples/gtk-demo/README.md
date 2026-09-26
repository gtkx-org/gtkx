# gtk-demo

An Adwaita-based, searchable React port of [gtk4-demo](https://gitlab.gnome.org/GNOME/gtk/-/tree/main/demos/gtk-demo). It places GTK collections, CSS, layouts, dialogs, gestures, OpenGL, Cairo, media, text, navigation, and actions inside an Adwaita application shell.

Follow the [workspace setup](../../CONTRIBUTING.md#set-up-the-workspace), install the GtkSourceView 5 development package, then run from the repository root:

```bash
pnpm --filter gtk-demo dev
pnpm vitest run --project gtk-demo
```

See the [GTKX guides](https://gtkx.dev/v2/guide/components) and the demos under `src/demos`.

## Media troubleshooting

The Images demo enables looping on a shared media stream. GStreamer's native teardown race is tracked in [#758](https://github.com/gtkx-org/gtkx/issues/758); a fix in supported GStreamer releases has not been verified. Earlier advice to avoid looping does not describe the current demo. The TODO beside the stream configuration tracks this discrepancy.
