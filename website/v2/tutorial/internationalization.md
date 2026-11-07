---
description: "Extract the app's messages into a gettext template and add a French translation."
---

# Translate the App

Extract the messages marked since the first chapter into a gettext template, add a French translation, and check it in a test.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Extract the messages

Every visible string has gone through `t()` since [Create a Window](/v2/tutorial/your-first-window). GTKX starts managing translations once the project has a `po` folder whose `LINGUAS` file lists the locales:

```text [po/LINGUAS]
fr
```

Run `npm run codegen`. GTKX writes the template `po/dev.gtkx.Notes.pot` with every `t()` message and the summary and description of each settings key, and creates `po/fr.po` from it with `msginit`. Each entry records where the message comes from:

```po [po/dev.gtkx.Notes.pot]
#: src/components/main-menu.tsx:15 src/components/notes-screen.tsx:135
msgid "New Note"
msgstr ""
```

See [Create a catalog](/v2/guide/internationalization#create-a-catalog) and [Translate settings schemas](/v2/guide/internationalization#translate-settings-schemas).

## Add a translation

Fill in each `msgstr` in `po/fr.po`, and replace the generated header comments and `Last-Translator` with your own. Placeholders such as <code v-pre>{{name}}</code> stay as they are; i18next fills them in after gettext returns the translation:

```po [po/fr.po]
#: src/components/window-actions.tsx:37
msgid "“{{name}}” moved to Trash"
msgstr "« {{name}} » a été mise à la corbeille"
```

The [finished app's catalog](https://github.com/gtkx-org/gtkx/blob/main/tutorial/po/fr.po) has every French message. When you change a message later, run codegen again: it updates the template and merges the change into `fr.po`.

## Plurals

The note count under the sidebar title gives `t()` the singular and plural source strings:

```tsx [src/components/notes-screen.tsx]
t("{{count}} note", {
    count: notes.size,
    defaultValue_one: "{{count}} note",
    defaultValue_other: "{{count}} notes",
});
```

The catalog holds one translation per plural form. Its `Plural-Forms` header, which `msginit` filled in for French, picks the form from the count: French uses the singular for 0 and 1.

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

gettext reads the locale when the process starts, so the French checks run in their own Vitest configuration with a French environment. `gtkx build` compiles the catalogs into `dist/locale`, and `localeDir` points the test plugin at them:

<<< @/figures/tutorial/internationalization/vitest.i18n.config.ts [vitest.i18n.config.ts]

The test files end in `.i18n.tsx`, so the main configuration's `*.test.tsx` pattern skips them. They reuse Test the App's setup and fixtures, and check a tooltip and a placeholder, the plural forms as notes are deleted, and a toast that interpolates the note's name:

<<< @/figures/tutorial/internationalization/tests/localization.i18n.tsx [tests/localization.i18n.tsx]

Add a script that builds and runs them, and make `npm test` run both suites:

```json [package.json]
"scripts": {
    "test": "vitest run && npm run test:i18n",
    "test:i18n": "gtkx build && vitest run --config vitest.i18n.config.ts"
}
```

## Run it

The French locale must be installed: `locale -a` lists it, and on Fedora it comes with `glibc-langpack-fr`. Start the app in French:

```bash
LANG=fr_FR.UTF-8 LANGUAGE=fr npm run dev
```

The sidebar, menus, dialogs and toasts are in French, and the note count follows French plural rules. See [Develop and build](/v2/guide/internationalization#develop-and-build).

<figure class="result">
    <img class="result-light" src="/figures/tutorial-internationalization-light.png" width="720" height="480" loading="lazy" alt="The Notes window in French: the sidebar subtitle reads 5 notes, the search entry says Rechercher dans les notes, the main menu lists Nouvelle note, Préférences, Raccourcis clavier and À propos de Notes, and the empty pane reads Aucune note sélectionnée." />
    <img class="result-dark" src="/figures/tutorial-internationalization-dark.png" width="720" height="480" loading="lazy" alt="The Notes window in French with the dark style: the sidebar subtitle reads 5 notes, the search entry says Rechercher dans les notes, the main menu lists Nouvelle note, Préférences, Raccourcis clavier and À propos de Notes, and the empty pane reads Aucune note sélectionnée." />
    <figcaption>Captured with <a href="#add-a-translation"><code>po/fr.po</code></a> above, with the main menu open.</figcaption>
</figure>
