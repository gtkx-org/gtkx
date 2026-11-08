import type { BundledLanguage } from "shiki";

type Snippet = { lang: BundledLanguage; code: string; mark?: string };

const NOTE_LIST = `<ListView<Note>
  items={shown.map((note) => ({
    id: note.name,
    value: note,
  }))}
  renderItem={({ item }) => (
    <NoteRow note={item} />
  )}
/>
`;

const APP = `<AdwToolbarView
  top={<AdwHeaderBar />}
>
  <GtkScale
    adjustment={
      <GtkAdjustment upper={100} />
    }
    drawValue
    onValueChanged={(scale) =>
      setVolume(scale.getValue())
    }
  />
</AdwToolbarView>
`;

const TEST = `it("saves the name", async () => {
  await render(<SettingsPanel />);

  const name = screen.getByRole(
    Gtk.AccessibleRole.TEXT_BOX,
    { name: "Display name" },
  );
  await userEvent.type(name, "Ada");
  await userEvent.click(
    screen.getByRole(
      Gtk.AccessibleRole.BUTTON,
      { name: "Save" },
    ),
  );

  expect(
    await screen.findByText(
      "Settings saved",
    ),
  ).toBeVisible();
});
`;

const DEPLOY = `export default defineConfig({
  applicationId: "dev.gtkx.Notes",
  applicationIcon: "data/icons",
  deploy: {
    name: "Notes",
    genericName: "Markdown Notes",
    categories: [
      "Utility", "TextEditor",
    ],
    targets: [
      "flatpak", "deb",
      "rpm", "appimage",
    ],
  },
});
`;

const SNIPPETS = {
    noteList: { lang: "tsx", code: NOTE_LIST, mark: "NoteRow" },
    app: { lang: "tsx", code: APP },
    test: { lang: "tsx", code: TEST },
    deploy: { lang: "ts", code: DEPLOY },
} satisfies Record<string, Snippet>;

export { type Snippet, SNIPPETS };
