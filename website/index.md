---
title: "GTKX: The React framework for Linux"
titleTemplate: false
description: Write declarative JSX. GTKX renders it to GObject instances, powered by a native Rust core.
layout: home
hero:
  name: GTKX
  text: Native Linux apps with React
  tagline: Write declarative TypeScript and JSX. GTKX renders real GTK4 and Adwaita objects through a native Rust core.
  image:
    src: /gtkx-mark.svg
    alt: GTKX
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/gtkx-org/gtkx
features:
  - title: Native objects
    details: Compose the complete GObject graph as typed JSX.
  - title: Fast Refresh
    details: Patch the running GTK window as source files change.
  - title: Generated bindings
    details: Keep types and native calls aligned with installed GIR libraries.
  - title: GTK testing
    details: Query and drive real widgets through user-visible behavior.
  - title: Linux tooling
    details: Build, localize, inspect, package, and deploy from one CLI.
  - title: React ecosystem
    details: Use React Navigation, React Spring, React Hook Form, and i18next.
---

## GTK4 in JSX

```tsx
import { GtkApplication, GtkApplicationWindow, GtkButton } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";

createRoot().render(
    <GtkApplication>
        <GtkApplicationWindow title="Hello GTKX" defaultWidth={400} defaultHeight={300} onCloseRequest={quit}>
            <GtkButton label="Hello from GTK" />
        </GtkApplicationWindow>
    </GtkApplication>,
);
```

GTKX generates `@gtkx/gi` and `@gtkx/jsx` from the libraries selected by each project. Browse the [examples](https://github.com/gtkx-org/gtkx/tree/main/examples), follow the [application tutorial](/tutorial/), or consult the [generated API reference](/reference/).
