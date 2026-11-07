import type { BundledLanguage } from "shiki";

type Snippet = { lang: BundledLanguage; code: string; mark?: string };

const TASK_FILTER = `<AdwToggleGroup activeName={filter}>
  <AdwToggle name="all" label={t("All")} />
  <AdwToggle name="open" label={t("Open")} />
  <AdwToggle name="done" label={t("Done")} />
</AdwToggleGroup>
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

const TEST = `it("saves the display name", async () => {
  await render(<SettingsPanel />);

  const name = screen.getByRole(
    Gtk.AccessibleRole.TEXT_BOX,
    { name: "Display name" },
  );
  await userEvent.type(name, "Ada");
  await userEvent.click(screen.getByRole(
    Gtk.AccessibleRole.BUTTON,
    { name: "Save" },
  ));

  expect(
    await screen.findByText("Settings saved"),
  ).toBeVisible();
});
`;

const DEPLOY = `export default defineConfig({
  applicationId: "com.example.Tasks",
  applicationIcon: "data/icons",
  deploy: {
    summary: "Manage your tasks and to-dos",
    categories: ["Office"],
    targets: ["flatpak", "deb", "rpm", "appimage"],
  },
});
`;

const SNIPPETS = {
    taskFilter: { lang: "tsx", code: TASK_FILTER, mark: "AdwToggleGroup" },
    app: { lang: "tsx", code: APP },
    test: { lang: "tsx", code: TEST },
    deploy: { lang: "ts", code: DEPLOY },
} satisfies Record<string, Snippet>;

export { type Snippet, SNIPPETS };
