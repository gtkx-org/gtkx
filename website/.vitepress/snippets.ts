import type { BundledLanguage } from "shiki";

/**
 * A landing-page code sample. `[[id:text]]` in `code` marks `text` as a hotspot named `id`: the markers are stripped
 * from the highlighted and copied code, and `text` becomes a button carrying `data-spot="id"`.
 */
type Snippet = { lang: BundledLanguage; code: string };

const NOTES_SCREEN = `<GtkBox orientation={Gtk.Orientation.VERTICAL}>
  <[[search:GtkSearchEntry]]
    placeholderText={t("Search notes")}
    text={query}
    onSearchChanged={(entry) =>
      setQuery(entry.getText())
    }
  />
  {tags.length > 0 && (
    <[[filter:TagFilter]]
      tags={tags}
      tag={tag}
      onChange={setSelectedTag}
    />
  )}
  <[[list:ListView]]<Note>
    items={shown.map((note) => ({
      id: note.name,
      value: note,
    }))}
    selectionMode={Gtk.SelectionMode.SINGLE}
    renderItem={({ item }) => (
      <[[row:NoteRow]] note={item} />
    )}
  />
</GtkBox>
`;

const NOTE_EDITOR = `<GtkScrolledWindow vexpand>
  <[[view:GtkSourceView]]
    ref={setView}
    accessibleLabel={t("Note text")}
    wrapMode={Gtk.WrapMode.WORD_CHAR}
    buffer={
      <GtkSourceBuffer
        text={text}
        language={[[language:markdown]]}
        styleScheme={styleScheme}
        onChanged={(buffer) => {
          onChange(
            buffer.getText(
              buffer.getStartIter(),
              buffer.getEndIter(),
              false,
            ),
          );
        }}
      />
    }
  />
</GtkScrolledWindow>
`;

const PREFERENCES = `<[[dialog:AdwPreferencesDialog]]
  onClosed={onClose}
  title={t("Preferences")}
>
  <AdwPreferencesPage title={t("General")}>
    <AdwPreferencesGroup title={t("Appearance")}>
      <[[combo:ComboRow]]
        title={t("Style")}
        items={colorSchemeItems()}
        selectedId={colorScheme}
        onSelectionChanged={(id) => {
          const scheme = toColorScheme(id);
          if (scheme !== undefined) {
            setColorScheme(scheme);
          }
        }}
      />
    </AdwPreferencesGroup>
    <[[storage:AdwPreferencesGroup]] title={t("Storage")}>
      <[[folder:FolderRow]] onError={onError} />
    </AdwPreferencesGroup>
  </AdwPreferencesPage>
</AdwPreferencesDialog>
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
    notesScreen: { lang: "tsx", code: NOTES_SCREEN },
    noteEditor: { lang: "tsx", code: NOTE_EDITOR },
    preferences: { lang: "tsx", code: PREFERENCES },
    app: { lang: "tsx", code: APP },
    test: { lang: "tsx", code: TEST },
    deploy: { lang: "ts", code: DEPLOY },
} satisfies Record<string, Snippet>;

export { type Snippet, SNIPPETS };
