---
description: "Translate the app and its desktop metadata with react-i18next, typed gettext catalogs, and one automated deploy pipeline."
---

# Speaking the User's Language

[Appendix B: Making It a Real Application](/v2/tutorial/packaging) turned the English app into installable packages. This chapter gives the interface, notifications, first-run content, dates, and release metadata one translation source, then proves that the same French catalog reaches every format.

GTKX does not imitate react-i18next. `@gtkx/i18n` registers a GNU gettext backend on the real `i18next` singleton and re-exports the real `react-i18next` API. Your components use `useTranslation`, `Trans`, `withTranslation`, and the rest of that package's surface. Translators work in PO files, and GLib reads the compiled MO catalog at runtime.

## Install the backend

Install the package:

```bash
npm install @gtkx/i18n@beta
```

The extraction and compilation tools require GNU gettext 0.25 or newer. On Debian or Ubuntu:

```bash
sudo apt install appstream desktop-file-utils gettext
```

The gettext package is also named `gettext` on Fedora and Arch, and `gettext-tools` on openSUSE. `desktop-file-utils` and AppStream provide the metadata validators deploy uses. GTKX checks the tools before doing release work and prints the right install command for the current distribution when one is missing.

Create `po/LINGUAS` as an empty file. Its entries will be the locales the project ships:

```text
po/
└─ LINGUAS
```

The application ID, `com.gtkx.tutorial`, is the gettext domain. There is no locale setting in `gtkx.config.ts`, and the catalogs are ordinary project files rather than resource imports.

## Mark interface text

Use the react-i18next hook inside a component. In `src/components/window.tsx`, import it and translate the window title, navigation title, tooltips, and empty state:

```tsx
import { useTranslation } from "@gtkx/i18n";
// ...

const NothingSelected = () => {
    const { t } = useTranslation();

    return (
        <AdwStatusPage
            iconName="view-list-symbolic"
            title={t("Nothing Selected")}
            description={t("Pick a list or a smart view in the sidebar")}
        />
    );
};

export const Window = () => {
    const { t } = useTranslation();
    // ...

    return (
        <AdwApplicationWindow title={t("Tasks")}>
            {/* ... */}
            <GtkButton
                iconName="list-add-symbolic"
                tooltipText={t("New Task (Ctrl+N)")}
                actionName="win.new"
            />
            {/* ... */}
        </AdwApplicationWindow>
    );
};
```

The translated value changes, while identifiers do not. `win.new`, route names, icon names, CSS classes, settings keys, application IDs, and accelerators are protocols rather than prose. Leave them alone. User-entered task and list names also stay exactly as the user wrote them.

The bound `t` export from the same i18next singleton is convenient outside a component. In `src/format.ts`, translate the relative date around its runtime values:

```ts
import { t } from "@gtkx/i18n";

// ...

if (days === 0) return t("Today at {{time}}", { time });
if (days === 1) return t("Tomorrow at {{time}}", { time });
if (days === -1) return t("Yesterday at {{time}}", { time });
if (days < 0)
    return t("{{count}} day ago", {
        count: -days,
        defaultValue_one: "{{count}} day ago",
        defaultValue_other: "{{count}} days ago",
    });
```

Interpolation names are part of the message contract. A translator can move `{{time}}` or `{{count}}`, while the generated TypeScript declarations ensure every caller supplies the required value. The one/other defaults become one GNU gettext plural entry, so each locale's `Plural-Forms` rule chooses the result.

Apply the same rule everywhere the application authors the text:

- headings, labels, placeholders, tooltips, dialog responses, empty states, and accessible labels;
- toast and notification text;
- relative phrases around dates, while `toLocaleString` continues to format the date itself;
- the starter lists, tasks, and notes created on a user's first run.

The starter content is translated when it is created and then becomes user data. Changing locale later does not rewrite a persisted task, which is important because the user may already have edited it.

For example, the search empty state in `src/store/selectors.ts` preserves what the user typed:

```ts
description: t("No tasks match “{{query}}”", { query }),
```

And `src/notifications.ts` uses the same catalog even when the shell displays the result outside the window:

```ts
notification.setBody(t("Due {{date}}", { date: formatDateTime(task.due) }));
notification.addButtonWithTarget(
    t("Mark Complete"),
    "app.complete-task",
    GLib.Variant.newString(task.id),
);
```

## Let deploy build the catalog lifecycle

The human work is choosing a locale and translating its `msgstr` values. The mechanical work belongs to the CLI.

Declare French in `po/LINGUAS`:

```text
fr
```

Now run one manifest preview:

```bash
npm run deploy -- --print-manifests
```

That command runs codegen, extracts statically recoverable messages declared with the exact names `t`, `useTranslation`, `Trans`, and `TransWithoutContext`, writes `po/POTFILES.in`, initializes the missing `po/fr.po` with the correct French headers and plural rule, adds the name, summary, descriptions, screenshots, release notes, and other translatable deploy metadata, then synchronizes the catalog. Imported aliases, member calls, dynamic keys, and CommonJS declarations are not extraction forms. The preview validates the desktop entry and AppStream file but builds no packages.

Fill every empty `msgstr` in `po/fr.po`; an empty value deliberately falls back to English and would make the localized integration test fail. These entries include the controls and starter content that test reaches, plus interpolation, a plural, and the application name that also appears in desktop metadata:

```po
msgid "Tasks"
msgstr "Tâches"

msgid "New Task (Ctrl+N)"
msgstr "Nouvelle tâche (Ctrl+N)"

msgid "Search (Ctrl+F)"
msgstr "Rechercher (Ctrl+F)"

msgid "Search tasks…"
msgstr "Rechercher des tâches…"

msgid "Water the plants"
msgstr "Arroser les plantes"

msgid "No tasks match “{{query}}”"
msgstr "Aucune tâche ne correspond à « {{query}} »"

msgid "{{count}} day ago"
msgid_plural "{{count}} days ago"
msgstr[0] "Il y a {{count}} jour"
msgstr[1] "Il y a {{count}} jours"
```

Do not run `msginit`, `xgettext`, `msgmerge`, or `msgfmt` yourself. Every `gtkx codegen`, `gtkx dev`, and `gtkx build` initializes newly listed locales, refreshes the source template, and synchronizes each PO file. `gtkx deploy` goes further: it refreshes source and deploy-metadata messages, synchronizes the PO files, compiles MO files, localizes the freedesktop metadata, stages the shared locale tree, and packages it. A stale translation cannot silently miss a newly extracted entry; the new empty `msgstr` is placed in the PO file for a translator to fill.

Commit `po/LINGUAS`, the PO and POT files, and `POTFILES.in`. Do not commit `dist/locale` or any `.mo` file; those are reproducible build products.

## See the generated contract

Codegen writes standard i18next resources under `node_modules/.gtkx` and augments the `I18nResources` interface exported by `@gtkx/i18n`. That interface supplies i18next's `CustomTypeOptions`, so you never maintain message-key types by hand.

After extraction, TypeScript knows that this message requires `query`:

```ts
t("No tasks match “{{query}}”", { query }); // valid
t("No tasks match “{{query}}”"); // type error
t("No tasks match “{{query}}”", { name }); // type error
```

The upstream i18next types also reject unknown literal messages and a plural call without a numeric `count`. GTKX does not maintain a separate message registry.

## Run it in French

Start a fresh data directory so the first-run tasks are created from the French catalog instead of loaded from the English JSON you already used:

```bash
LANG=fr_FR.UTF-8 \
LANGUAGE=fr \
XDG_DATA_HOME="$(mktemp -d)" \
npm run dev
```

The window title reads **Tâches**, the new-task tooltip reads **Nouvelle tâche (Ctrl+N)**, and the starter task **Water the plants** reads **Arroser les plantes**. Search for `introuvable` to see the interpolation in the empty state.

The locale is process-wide because GLib and libc cache gettext catalogs. Quit and restart after changing `LANG`, `LC_ALL`, or `LANGUAGE`; an i18next language-change call cannot replace the process locale while the app is running.

## Test another locale in another process

That process boundary applies to tests too. Keep the English suite in `vitest.config.ts`, and create `vitest.i18n.config.ts` for French:

```ts
import gtkx from "@gtkx/cli/vitest-plugin";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        include: ["tests/**/*.i18n.tsx"],
        setupFiles: ["./tests/setup.ts"],
        bail: 1,
        env: {
            GTKX_LOCALE_DIR: resolve(import.meta.dirname, "dist/locale"),
            LANG: "fr_FR.UTF-8",
            LANGUAGE: "fr",
            LC_ALL: "fr_FR.UTF-8",
        },
    },
});
```

Build first so the test process can load `dist/locale/fr/LC_MESSAGES/com.gtkx.tutorial.mo`, then run that config in a separate Vitest invocation. In `package.json`:

```json
{
    "scripts": {
        "test": "vitest run && npm run test:i18n",
        "test:i18n": "gtkx build && vitest run --config vitest.i18n.config.ts"
    }
}
```

The localized integration test renders the real application, queries **Nouvelle tâche (Ctrl+N)** and **Arroser les plantes** through GTK's accessibility tree, searches for an absent task, and verifies the two-day plural. That covers the backend, compiled catalog, interpolation, plural rule, React tree, and native widgets together rather than testing an extraction helper.

## Run the release pipeline

Now run the same command you use for any release:

```bash
npm run deploy
```

The release is still one command, and the localization work is visible in the shared stage before the packagers consume it:

```
[gtkx] Deploying Tasks 1.0.0-1 as gtkx-tutorial (x86_64) to appimage, deb, flatpak, rpm
[gtkx] Building ~/tasks/src/index.tsx
[gtkx] Validated the desktop entry and the metainfo
[gtkx] Bundled Node.js v26.7.0 (109.4 MiB, glibc >= 2.28)
[gtkx] Staged 11 files into build/stage
[gtkx] Wrote build/targets/appimage/AppRun
[gtkx] Wrote build/targets/deb/nfpm.yaml
[gtkx] Wrote build/targets/flatpak/com.gtkx.tutorial.yml
[gtkx] Wrote build/targets/rpm/nfpm.yaml
[gtkx] Built build/out/Tasks-1.0.0-x86_64.AppImage (36.9 MiB)
[gtkx] Built build/out/gtkx-tutorial_1.0.0-1_amd64.deb (40.6 MiB)
[gtkx] Built build/out/com.gtkx.tutorial-1.0.0-x86_64.flatpak (26.4 MiB)
[gtkx] Built build/out/gtkx-tutorial-1.0.0-1.x86_64.rpm (40.5 MiB)
[gtkx] Deploy complete: 4 artifacts in build/out
```

The extra staged file is the compiled catalog. Deb and rpm install it at `/usr/share/locale/fr/LC_MESSAGES/com.gtkx.tutorial.mo`; Flatpak installs the same tree below `/app`, and AppImage carries it below its temporary mount point. The generated launcher derives that prefix at runtime and sets `GTKX_LOCALE_DIR`, so application code contains no package-specific path.

The version number has not changed since Appendix B, so reinstall whichever system package you used before testing it:

```bash
sudo apt install --reinstall ./build/out/gtkx-tutorial_1.0.0-1_amd64.deb
sudo dnf reinstall ./build/out/gtkx-tutorial-1.0.0-1.x86_64.rpm
```

Then launch the installed package and the new AppImage in French:

```bash
LANG=fr_FR.UTF-8 LANGUAGE=fr gtkx-tutorial
LANG=fr_FR.UTF-8 LANGUAGE=fr ./build/out/Tasks-1.0.0-x86_64.AppImage
```

The desktop entry and software-center metadata are translated from that same PO before the application starts. The generated files include, among the rest of the French descriptions, keywords, captions, and release notes:

```ini
Name[fr]=Tâches
GenericName[fr]=Gestionnaire de tâches
Comment[fr]=Gérez vos tâches et listes de choses à faire
Keywords[fr]=Tâche;Tâches;À faire;À-faire;Liste de contrôle;
```

```xml
<name xml:lang="fr">Tâches</name>
<summary xml:lang="fr">Gérez vos tâches et listes de choses à faire</summary>
<caption xml:lang="fr">Modification d’une tâche</caption>
<p xml:lang="fr">Version initiale.</p>
```

There is no localization-specific packaging step. Repeating an unchanged deploy leaves the POT and PO files byte-for-byte untouched; a real source or metadata change advances the POT date and adds the new entries for translators.

## Next

[Shipping It on Flathub](/v2/tutorial/flatpak) builds the localized Flatpak in a sandbox and prepares its source-mode submission.
