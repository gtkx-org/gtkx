---
description: "Extract the app's messages into a gettext template and add a French translation."
---

# Translate the App

Extract the messages marked since the first chapter into a gettext template, add a French translation, and check it in a test.

GTK apps are translated with [GNU gettext](https://www.gnu.org/software/gettext/manual/gettext.html): a template lists the messages, and translators fill in one [PO file](https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html) per language. `@gtkx/i18n` keeps i18next's `t()` in the components and lets gettext look up each translation, so the catalogs follow the format GNOME translators already work with. [Internationalization](/v2/guide/internationalization) covers it in full.

## Extract the messages

Every visible string has gone through `t()` since [Create a Window](/v2/tutorial/your-first-window), which also installed `@gtkx/i18n`. GTKX starts managing translations once such a project has a `po` folder whose `LINGUAS` file lists the locales, one per line:

```text [po/LINGUAS]
fr
```

Then run codegen. It calls the gettext tools that the [tutorial's requirements](/v2/tutorial/) list:

```sh
npm run codegen
```

GTKX writes the template `po/dev.gtkx.Notes.pot`, named after the application ID, with every `t()` message and the summary and description of each settings key. It creates `po/fr.po` from the template with `msginit`, and lists the files it read in `po/POTFILES.in`. Each entry gives the source text as `msgid`, an empty `msgstr` for the translation, and a `#:` comment with the lines it comes from:

```po [po/dev.gtkx.Notes.pot]
#: src/components/main-menu.tsx:15 src/components/notes-screen.tsx:135
msgid "New Note"
msgstr ""
```

The same text in two places is one message, translated once. See [Create a catalog](/v2/guide/internationalization#create-a-catalog) and [Translate settings schemas](/v2/guide/internationalization#translate-settings-schemas).

## Add a translation

Fill in each `msgstr` in `po/fr.po`, and replace the generated header comments and `Last-Translator` with your own. Placeholders such as <span v-pre>`{{name}}`</span> stay as they are; i18next fills them in after gettext returns the translation:

```po [po/fr.po]
#: src/components/window-actions.tsx:37
msgid "“{{name}}” moved to Trash"
msgstr "« {{name}} » a été mise à la corbeille"
```

The [finished app's catalog](https://github.com/gtkx-org/gtkx/blob/main/tutorial/po/fr.po) has every French message. When you change a message later, run codegen again: it updates the template and merges the change into `fr.po`. `npm run dev` updates only the template as you save, and leaves the PO files to codegen and builds.

## Plurals

The note count under the sidebar title is a plural message. `t()` takes the singular as its key, the number as `count`, and both English forms as `defaultValue_one` and `defaultValue_other`:

```tsx [src/components/notes-screen.tsx]
t("{{count}} note", {
    count: notes.size,
    defaultValue_one: "{{count}} note",
    defaultValue_other: "{{count}} notes",
});
```

Its catalog entry has both source forms and one translation per plural form of the language. The `Plural-Forms` header, which `msginit` filled in for French, picks the form from the count. Its [rule](https://www.gnu.org/software/gettext/manual/html_node/Plural-forms.html) gives French the singular for 0 and 1, where English uses the plural for 0:

```po [po/fr.po]
"Plural-Forms: nplurals=2; plural=(n > 1);\n"

#: src/components/notes-screen.tsx:100
msgid "{{count}} note"
msgid_plural "{{count}} notes"
msgstr[0] "{{count}} note"
msgstr[1] "{{count}} notes"
```

See [Plurals and context](/v2/guide/internationalization#plurals-and-context).

## Test the translation

The tests from [Test the App](/v2/tutorial/testing) still render the English source text: the Vitest plugin compiles no catalogs, and the main configuration sets an English locale. gettext reads the locale once, when the process starts, so the French checks run in their own Vitest configuration with a French environment for its workers. `localeDir` points the plugin at the catalogs that `gtkx build` compiles into `dist/locale`:

<<< @/figures/tutorial/internationalization/vitest.i18n.config.ts [vitest.i18n.config.ts]

It runs the files ending in `.i18n.tsx`, which the main configuration's `tests/**/*.test.{ts,tsx}` pattern skips, and reuses the setup file, so each test starts from the same two fixture notes. The tests find the New Note button by its French tooltip and the search entry by its placeholder, delete notes until the count reads "0 note", and check the toast that names a trashed note:

<<< @/figures/tutorial/internationalization/tests/localization.i18n.tsx [tests/localization.i18n.tsx]

Add a script that builds and runs them, and make `npm test` run both suites:

```json{3,4} [package.json]
{
    "scripts": {
        "test": "vitest run && npm run test:i18n",
        "test:i18n": "gtkx build && vitest run --config vitest.i18n.config.ts"
    }
}
```

See [Test translations](/v2/guide/internationalization#test-translations).

## Run it

The French locale must be installed: `locale -a` lists it, and on Fedora it comes with `glibc-langpack-fr`. Start the app in French:

```sh
LANG=fr_FR.UTF-8 LANGUAGE=fr npm run dev
```

The sidebar, menus, dialogs and toasts are in French, and the note count follows French plural rules. Saving `po/fr.po` restarts the app, since gettext keeps the catalogs it loaded for the life of the process. See [Develop and build](/v2/guide/internationalization#develop-and-build).

<figure class="result">
    <img class="result-light" src="/figures/tutorial-internationalization-light.png" width="720" height="480" loading="lazy" alt="The Notes window in French: the sidebar subtitle reads 5 notes, the search entry says Rechercher dans les notes, the main menu lists Nouvelle note, Préférences, Raccourcis clavier and À propos de Notes, and the empty pane reads Aucune note sélectionnée." />
    <img class="result-dark" src="/figures/tutorial-internationalization-dark.png" width="720" height="480" loading="lazy" alt="The Notes window in French with the dark style: the sidebar subtitle reads 5 notes, the search entry says Rechercher dans les notes, the main menu lists Nouvelle note, Préférences, Raccourcis clavier and À propos de Notes, and the empty pane reads Aucune note sélectionnée." />
    <figcaption>Captured with <a href="#add-a-translation"><code>po/fr.po</code></a> above, with the main menu open.</figcaption>
</figure>
