import type { BundledLanguage } from "shiki";

type Snippet = { lang: BundledLanguage; code: string; mark?: string };

const TASK_FILTER = `<AdwToggleGroup activeName={filter}>
  <AdwToggle name="all" label={t("All")} />
  <AdwToggle name="open" label={t("Open")} />
  <AdwToggle name="done" label={t("Done")} />
</AdwToggleGroup>
`;

const CONFIG = `import { defineConfig } from "@gtkx/config";

export default defineConfig({
  applicationId: "com.example.myapp",
  libraries: ["WebKit-6.0"],
});
`;

const APP = `<AdwToolbarView top={<AdwHeaderBar />}>
  <GtkScale
    adjustment={<GtkAdjustment upper={100} />}
    drawValue
    onValueChanged={(scale) =>
      setVolume(scale.getValue())
    }
  />
</AdwToolbarView>
`;

const ECOSYSTEM = "npm install zod zustand";

const SNIPPETS = {
    taskFilter: { lang: "tsx", code: TASK_FILTER, mark: "AdwToggleGroup" },
    config: { lang: "ts", code: CONFIG },
    app: { lang: "tsx", code: APP },
    ecosystem: { lang: "bash", code: ECOSYSTEM },
} satisfies Record<string, Snippet>;

export { type Snippet, SNIPPETS };
