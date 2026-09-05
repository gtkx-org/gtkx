import type { BundledLanguage } from "shiki";

type Snippet = { lang: BundledLanguage; code: string };

const HERO = `import {
  AdwApplication, AdwApplicationWindow,
  AdwHeaderBar, AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";

const App = () => (
  <AdwApplication>
    <AdwApplicationWindow title="My App" onCloseRequest={() => quit()}>
      <AdwToolbarView topBar={<AdwHeaderBar />}>
        <GtkLabel>Hello from GNOME 👋</GtkLabel>
      </AdwToolbarView>
    </AdwApplicationWindow>
  </AdwApplication>
);

createRoot().render(<App />);
`;

const CONFIG = `import { defineConfig } from "@gtkx/config";

export default defineConfig({
  applicationId: "com.example.myapp",
  libraries: ["WebKit-6.0"],
  future: { v2DefaultLibraries: true },
});
`;

const APP = `<AdwToolbarView topBar={<AdwHeaderBar />}>
  <GtkScale
    adjustment={<GtkAdjustment upper={100} />}
    drawValue
  />
</AdwToolbarView>
`;

const ECOSYSTEM = `{
  "dependencies": {
    "@gtkx/react": "*",
    "react": "*",
    "zod": "*",
    "zustand": "*"
  }
}
`;

const SNIPPETS = {
    hero: { lang: "tsx", code: HERO },
    config: { lang: "ts", code: CONFIG },
    app: { lang: "tsx", code: APP },
    ecosystem: { lang: "json", code: ECOSYSTEM },
} satisfies Record<string, Snippet>;

export { type Snippet, SNIPPETS };
