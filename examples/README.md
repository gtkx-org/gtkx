# GTKX examples

These applications use the GTKX packages in this workspace. Start with [Hello World](hello-world/) for a small application or the [Tasks tutorial](../tutorial/) for a complete app.

| Example                       | What it demonstrates                                                         |
| ----------------------------- | ---------------------------------------------------------------------------- |
| [Hello World](hello-world/)   | An Adwaita window, React state, and button signals.                          |
| [Navigation](navigation/)     | Nested drawer, stack, and tab navigators with unsaved-change confirmation.   |
| [Animations](animations/)     | Springs, transitions, layout transforms, and motion preferences.             |
| [Storybook](storybook/)       | Native component stories, controls, actions, and reusable integration tests. |
| [Browser](browser/)           | WebKitGTK with native navigation controls.                                   |
| [Adwaita Demo](adwaita-demo/) | Adwaita widgets, adaptive layouts, and application patterns.                 |
| [GTK Demo](gtk-demo/)         | GTK widgets, collections, graphics, media, and input.                        |

Complete the [workspace setup](../CONTRIBUTING.md#set-up-the-workspace), then run an example from the repository root:

```sh
pnpm nx run hello-world:dev
```

Replace `hello-world` with the example's directory name; Storybook uses `storybook-example`. For a private display and live inspection, follow the [MCP guide](https://gtkx.dev/v2/guide/mcp).

The browser additionally needs WebKitGTK 6.0 development files. GTK Demo needs GtkSourceView 5 and GTK 4.22 or later. Adwaita Demo needs libadwaita 1.9 or later. Each example's README covers its requirements and behavior.

To build your own standalone application, use [Getting Started](https://gtkx.dev/v2/guide/getting-started). The [Tasks app](../tutorial/) installs published packages separately from this workspace.
