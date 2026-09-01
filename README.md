<p align="center">
  <img src="https://raw.githubusercontent.com/gtkx-org/gtkx/main/logo.svg" alt="GTKX" width="100" />
</p>

<h1 align="center">GTKX</h1>

<p align="center">Native GTK4 applications with React, TypeScript, and Node.js.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/create-gtkx"><img src="https://img.shields.io/npm/v/create-gtkx?color=cb3837&logo=npm&label=create-gtkx" alt="npm version" /></a>
  <a href="https://github.com/gtkx-org/gtkx/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/gtkx-org/gtkx/ci.yml?branch=main&logo=github&label=CI" alt="CI status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue.svg" alt="MPL-2.0" /></a>
</p>

<p align="center">
  <a href="https://gtkx.dev/guide/getting-started">Guide</a> ·
  <a href="https://gtkx.dev/tutorial/">Tutorial</a> ·
  <a href="https://gtkx.dev/reference/">API reference</a> ·
  <a href="examples">Examples</a>
</p>

GTKX renders generated GObject bindings as JSX. React owns state and composition while GTK4 and Adwaita provide native widgets. The CLI adds code generation, Fast Refresh, testing, bundling, and Linux packaging.

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";
import { useState } from "react";

const App = () => {
    const [count, setCount] = useState(0);

    return (
        <GtkApplication>
            <GtkApplicationWindow title="Hello GTKX" defaultWidth={400} defaultHeight={300} onCloseRequest={quit}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} marginTop={24} marginBottom={24}>
                    <GtkLabel label={`Count: ${count}`} />
                    <GtkButton label="Increment" onClicked={() => setCount((value) => value + 1)} />
                </GtkBox>
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

createRoot().render(<App />);
```

`@gtkx/gi` and `@gtkx/jsx` are generated for the libraries declared by each project, so native calls and TypeScript types stay aligned.

## Start

GTKX requires Linux, Node.js 26.7 or later, and development packages for GTK 4.20, GLib, and Adwaita 1.8. Prebuilt native addons cover x64 and arm64 glibc Linux.

```bash
npm create gtkx
cd my-app
npm run dev
```

See [Getting Started](https://gtkx.dev/guide/getting-started) for system setup and [the tutorial](https://gtkx.dev/tutorial/) for a complete application.

## Explore

The [examples](examples) cover a minimal app, GTK's widget demo, WebKit, animations, navigation, and the tutorial project. GTKX is stable and ready for production use.

Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md), the [Code of Conduct](CODE_OF_CONDUCT.md), and the [security policy](SECURITY.md).

GTKX is licensed under [MPL-2.0](LICENSE).
