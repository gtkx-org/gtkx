# Adwaita Demo

The official [libadwaita 1.9.3 demo](https://github.com/GNOME/libadwaita/tree/5789add99c79cee0fae624b56706c7c0bea7fb2b/demo), reimplemented in React and GTKX. The reference is pinned to `5789add99c79cee0fae624b56706c7c0bea7fb2b`; the application uses JSX and public native APIs throughout.

## Run

Follow the [workspace setup](../../CONTRIBUTING.md#set-up-the-workspace). This example requires libadwaita 1.9 or later for its sidebar and shortcuts widgets. The initial reference environment uses libadwaita 1.9.3 and GTK 4.22.4.

From the repository root:

```bash
pnpm nx run adwaita-demo:dev
```

Build and run the production output:

```bash
pnpm nx run adwaita-demo:build
pnpm --filter adwaita-demo start
```

For live inspection on an isolated display, start the [GTKX MCP server](https://gtkx.dev/v2/guide/mcp), then run:

```bash
pnpm --filter adwaita-demo exec gtkx dev --headless --size 1280x900
```

## Explore

The sidebar follows the official demo's categories and page order:

- Navigation: Navigation View, Split Views, View Switcher, Tab View, Bottom Sheet, Carousel.
- Controls: Boxed Lists, Toggle Groups, Buttons.
- Display: Banner, Toasts, Spinner, Avatar.
- Dialogs: Alert Dialog, About Dialog.
- Layout: Clamp, Wrap Box, Multi-Layout View.
- Miscellaneous: Style Classes, Animations.

The main menu opens Preferences, Keyboard Shortcuts, Inspector, Adaptive Preview, and application information. Narrow windows switch the sidebar to a navigation page. Selecting a different demo recreates its local state, matching the reference.

Page implementations live in `src/pages`, with the registry in `src/page-registry.ts`. The JSX keeps native Adwaita navigation, breakpoints, gestures, dialogs, animation timing, and tab behavior visible. The Style Classes page includes the full gallery and its secondary dialogs; the About Dialog page retains the fictional Typeset sample.

The tab demo shares a `createTabCollection` across windows so JSX page state survives native transfers. Pinning, tab drop targets, About dialog metadata, text direction, and the animation layout are configured declaratively. The stylesheet uses the CLI’s regular CSS import pipeline.

## Reference and differences

This implementation was written from the official GNOME sources. [Discussion 791](https://github.com/gtkx-org/gtkx/discussions/791) prompted the example; its linked implementation is not a source dependency.

The application has a distinct `org.gtkx.AdwaitaDemo` identity, GTKX application metadata and runtime diagnostics. Demonstration text is English. Spring mass and stiffness stay above zero, as required by the native animation API. Avatar file failures produce a toast, and saving proposes `avatar.png`. Native library differences can affect rendering, so compare screenshots using matching GTK and libadwaita versions. Avatar PNG export requires a renderer that supports its render nodes: GL export works; the Cairo renderer used by `gtkx dev --headless` produces a solid fallback image with GTK 4.22.4 and libadwaita 1.9.3, also reproduced in the native demo.

The shared toast controller dismisses tracked toast handles individually. This preserves the demo's Dismiss All behavior while avoiding a libadwaita 1.9.3 `dismiss_all` crash when a queued toast still has a running hide animation. The Style Classes gallery can emit a GTK 4.22.4 grid measurement warning; the same warning occurs with the unchanged upstream Check Buttons layout.

[IMPLEMENTATION.md](IMPLEMENTATION.md) records the implementation and validation checklist. Framework regression tests live in the package integration suites; this example does not add a separate application test suite.

## Upstream materials

The original demo and stylesheet are from libadwaita. Reused artwork retains its original licenses, including CC0 and CC BY-SA 4.0. See [NOTICE](NOTICE.txt), [the asset manifest](data/upstream-assets.json), and `data/licenses`. The artwork is unchanged apart from resource filenames. The GTKX application code is covered by the repository's MPL-2.0 license.
