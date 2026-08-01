import type { BundledLanguage } from "shiki";

type Snippet = { lang: BundledLanguage; code: string };

const HERO = `import {
  GtkApplication, GtkApplicationWindow, GtkLabel,
} from "@gtkx/jsx/gtk";
import { createRoot } from "@gtkx/react";

const App = () => (
  <GtkApplication>
    <GtkApplicationWindow title="My App">
      <GtkLabel>Hello from GTKX 👋</GtkLabel>
    </GtkApplicationWindow>
  </GtkApplication>
);

createRoot().render(<App />);
`;

const CONFIG = `import { defineConfig } from "@gtkx/config";

export default defineConfig({
  libraries: ["Gtk-4.0", "Adw-1", "WebKit-6.0"],
  applicationId: "com.example.myapp",
});
`;

const APP = `<AdwToolbarView topBar={<AdwHeaderBar />}>
  <GtkScale
    adjustment={<GtkAdjustment upper={100} />}
    drawValue
  />
</AdwToolbarView>
`;

const ECOSYSTEM = `import { css } from "@gtkx/css";
import { readFile } from "node:fs/promises";
import { useState } from "react";
`;

const SNIPPETS = {
    hero: { lang: "tsx", code: HERO },
    config: { lang: "ts", code: CONFIG },
    app: { lang: "tsx", code: APP },
    ecosystem: { lang: "tsx", code: ECOSYSTEM },
} satisfies Record<string, Snippet>;

export { type Snippet, SNIPPETS };
