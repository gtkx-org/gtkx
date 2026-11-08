# @gtkx/react

React renderer for native GTK and Adwaita apps.

`createRoot` renders React elements as GTK widgets. The package also provides portals and hooks for the application, windows, GObject properties, signals and GSettings. The elements come from `@gtkx/jsx`, which `gtkx codegen` generates for the native libraries in `gtkx.config.ts`. Apps created with `npm create gtkx` already depend on this package.

```tsx
import {
  AdwApplication, AdwApplicationWindow,
  AdwHeaderBar, AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";

const App = () => (
  <AdwApplication>
    <AdwApplicationWindow title="My App" onCloseRequest={() => quit()}>
      <AdwToolbarView top={<AdwHeaderBar />}>
        <GtkLabel>Hello from GTKX</GtkLabel>
      </AdwToolbarView>
    </AdwApplicationWindow>
  </AdwApplication>
);

createRoot().render(<App />);
```

[Guide](https://gtkx.dev/v2/guide/getting-started) · [API reference](https://gtkx.dev/v2/reference/@gtkx/react/) · [GTKX](https://gtkx.dev)

GTKX requires Linux, Node.js, and the [native prerequisites](https://gtkx.dev/v2/guide/getting-started#what-you-need).

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
