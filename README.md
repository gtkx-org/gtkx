<p align="center">
  <img src="https://raw.githubusercontent.com/eugeniodepalo/gtkx/main/logo.svg" alt="GTKX" width="80" height="80">
</p>

<h1 align="center">GTKX</h1>

<p align="center">
  <strong>Build native GTK4 desktop applications with React and TypeScript.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@gtkx/react"><img src="https://img.shields.io/npm/v/@gtkx/react.svg" alt="npm version"></a>
  <a href="https://github.com/eugeniodepalo/gtkx/actions"><img src="https://img.shields.io/github/actions/workflow/status/eugeniodepalo/gtkx/ci.yml" alt="CI"></a>
  <a href="https://github.com/eugeniodepalo/gtkx/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue.svg" alt="License"></a>
  <a href="https://github.com/eugeniodepalo/gtkx/discussions"><img src="https://img.shields.io/badge/discussions-GitHub-blue" alt="GitHub Discussions"></a>
</p>

---

GTKX lets you write Linux desktop applications using React. Your components render as native GTK4 widgets through a Rust FFI bridge—no webviews, no Electron, just native performance with the developer experience you already know.

## Quick Start

```bash
npx @gtkx/cli create my-app
cd my-app
npm run dev
```

## Example

```tsx
import {
  GtkApplicationWindow,
  GtkBox,
  GtkButton,
  GtkLabel,
  quit,
  render,
} from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const App = () => {
  const [count, setCount] = useState(0);

  return (
    <GtkApplicationWindow
      title="Counter"
      defaultWidth={300}
      defaultHeight={200}
      onCloseRequest={quit}
    >
      <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        spacing={20}
        valign={Gtk.Align.CENTER}
      >
        <GtkLabel label={`Count: ${count}`} cssClasses={["title-1"]} />
        <GtkButton label="Increment" onClicked={() => setCount((c) => c + 1)} />
      </GtkBox>
    </GtkApplicationWindow>
  );
};

render(<App />, "com.example.counter");
```

## Features

- **React 19** — Hooks, concurrent features, and the component model you know
- **Native GTK4 widgets** — Real native controls, not web components in a webview
- **Adwaita support** — Modern GNOME styling with Libadwaita components
- **Hot Module Replacement** — Fast refresh during development
- **TypeScript first** — Full type safety with auto-generated bindings
- **CSS-in-JS styling** — Familiar styling patterns adapted for GTK
- **Testing utilities** — Component testing similar to Testing Library

## Platform Support

| Platform | GTK Version | Status |
| -------- | ----------- | ------ |
| Linux    | 4.x         | Stable |
| Fedora   | 38+         | Tested |
| Ubuntu   | 22.04+      | Tested |

## Examples

Explore complete applications in the [`examples/`](./examples) directory:

- **[gtk4-demo](./examples/gtk4-demo)** — Widget gallery showcasing buttons, lists, dialogs, and menus
- **[todo](./examples/todo)** — Task management app with filtering and Adwaita styling
- **[adwaita](./examples/adwaita)** — Libadwaita components and modern GNOME patterns
- **[deploying](./examples/deploying)** — Flatpak packaging example

## Documentation

Visit [eugeniodepalo.github.io/gtkx](https://eugeniodepalo.github.io/gtkx/) for the full documentation.

## Contributing

Contributions are welcome! Please see the [contributing guidelines](./CONTRIBUTING.md) and check out the [good first issues](https://github.com/eugeniodepalo/gtkx/labels/good%20first%20issue).

## Community

- [GitHub Discussions](https://github.com/eugeniodepalo/gtkx/discussions) — Questions, ideas, and general discussion
- [Issue Tracker](https://github.com/eugeniodepalo/gtkx/issues) — Bug reports and feature requests

## License

[MPL-2.0](./LICENSE)
