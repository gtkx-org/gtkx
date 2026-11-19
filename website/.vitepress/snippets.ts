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

const LIBRARIES = `libraries: ["WebKit-6.0"],
`;

const WEB_VIEW = `<WebKitWebView
  accessibleLabel="Web page"
  onNotifyUri={handleUri}
  onNotifyIsLoading={handleIsLoading}
/>
`;

const TEST = `await userEvent.type(name, "Ada");
await userEvent.click(
  screen.getByRole(
    Gtk.AccessibleRole.BUTTON,
    { name: "Save" },
  ),
);
expect(
  await screen.findByText("Settings saved"),
).toBeVisible();
`;

const SNIPPETS = {
    notesScreen: { lang: "tsx", code: NOTES_SCREEN },
    noteEditor: { lang: "tsx", code: NOTE_EDITOR },
    preferences: { lang: "tsx", code: PREFERENCES },
    libraries: { lang: "ts", code: LIBRARIES },
    webView: { lang: "tsx", code: WEB_VIEW },
    test: { lang: "tsx", code: TEST },
} satisfies Record<string, Snippet>;

export { type Snippet, SNIPPETS };
