---
title: "Internationalization"
description: "Localize a GTKX application and its desktop metadata with react-i18next and GNU gettext catalogs."
---

# Internationalization

`@gtkx/i18n` connects the actual `i18next` and `react-i18next` implementations to GNU gettext. Components use the familiar React APIs, translators edit ordinary PO files, and the runtime resolves the compiled MO catalog through GLib. `gtkx deploy` uses that same catalog for the desktop entry, AppStream metainfo, and MIME descriptions.

There is no GTKX translation format or locale list in `gtkx.config.ts`. The application ID is the gettext domain, and `po/` is the catalog source of truth.

GTKX 2 requires Node.js 26.7 or newer, GNU gettext 0.25 or newer, and ESM application code. Install the package and the gettext command-line tools:

```bash
npm install @gtkx/i18n@beta
sudo apt install gettext # Debian and Ubuntu
```

The package is `gettext` on Fedora and Arch, and `gettext-tools` on openSUSE.

## Create the catalog

Add a `po` directory at the project root and declare the locales the project will ship in `po/LINGUAS`:

```text
# po/LINGUAS
fr
```

Write source messages with `t`, then run codegen:

```tsx
import { t } from "@gtkx/i18n";

const title = t("Tasks");
const countLabel = t("{{count}} task", {
    count,
    defaultValue_one: "{{count}} task",
    defaultValue_other: "{{count}} tasks",
});
```

```bash
npm run codegen
```

That one command creates the template and initializes every catalog that `LINGUAS` lists. The resulting tree uses the `applicationId` from `gtkx.config.ts` as its gettext domain:

```text
po/
├─ LINGUAS
├─ com.example.Tasks.pot
├─ fr.po
└─ POTFILES.in
```

`gtkx codegen`, `gtkx dev`, and `gtkx build` scan the application source with the upstream i18next extractor. GTKX writes `po/POTFILES.in`, passes normalized point, plural, and context messages to `xgettext`, and produces `po/<applicationId>.pot`. It uses `msginit --no-translator` to create a missing catalog and `msgmerge` to refresh an existing one. All outputs are prepared separately and replace the PO files only after every command succeeds, so one invalid locale or malformed catalog cannot leave the others half-updated.

Choosing the locales and translating their `msgstr` values remain human decisions. GTKX owns catalog initialization, template refresh, synchronization, compilation, and packaging; no manual `msginit`, `msgmerge`, or `msgfmt` command is needed. Messages removed from the source remain as standard obsolete PO entries, and a close source-string change may become fuzzy for a translator to review instead of shipping an unchecked translation.

This convention is independent of resource imports. PO files do not use `#data`, `?resource`, or a configuration entry.

## Translate messages

The package exports the configured i18next `t` function directly. Interpolation uses i18next syntax:

```tsx
import { t } from "@gtkx/i18n";

<GtkLabel label={t("Hello, {{name}}!", { name: profile.name })} />;
```

Use i18next's one/other defaults for cardinal plurals. GNU gettext chooses the plural form using the catalog's `Plural-Forms` expression:

```tsx
const label = t("{{count}} file", {
    count: files.length,
    defaultValue_one: "{{count}} file",
    defaultValue_other: "{{count}} files",
});
```

Codegen requires a recoverable singular/plural source pair. It rejects unpaired count calls, ordinal plurals, and zero-specific defaults because a GNU gettext cardinal entry cannot represent those i18next forms without changing their meaning.

Use i18next's `context` option when identical source text needs different translations:

```tsx
const command = t("Open", { context: "menu command" });
const fruit = t("{{count}} apple", {
    context: "fruit",
    count,
    defaultValue_one: "{{count}} apple",
    defaultValue_other: "{{count}} apples",
});
```

Missing messages retain i18next's normal key or `defaultValue` fallback behavior.

## React APIs

The root package re-exports the complete `react-i18next` surface. `useTranslation`, `withTranslation`, `Translation`, `Trans`, providers, SSR helpers, defaults, context, and the remaining exports are the upstream implementations rather than GTKX equivalents.

```tsx
import { Trans, useTranslation } from "@gtkx/i18n";

function Greeting({ name }: { name: string }) {
    const { t } = useTranslation();

    return (
        <GtkBox>
            <GtkLabel label={t("Hello, {{name}}!", { name })} />
            <GtkLabel>
                <Trans i18nKey="welcome">Welcome</Trans>
            </GtkLabel>
        </GtkBox>
    );
}
```

The named `t` and `init` exports are the bound functions from the same default i18next singleton registered with `initReactI18next`. GTKX installs a real i18next backend for catalog loading. A companion i18next format adapter performs each GLib lookup so GNU plural rules receive the original `count` and context before upstream interpolation runs.

`IcuTrans` and `IcuTransWithoutContext` are also the upstream components, but they are not catalog extraction forms. The gettext adapter occupies i18next's single custom-format slot, so catalog messages use ordinary i18next `{{name}}` interpolation and explicit one/other defaults instead of ICU MessageFormat.

Gettext uses one process-wide application domain. Passing a namespace to a react-i18next API does not create a second JSON resource store or gettext domain.

## Generated types and static extraction

GTKX delegates source scanning to `i18next-cli`. Catalog-owning ESM code must use the exact names `t`, `useTranslation`, `Trans`, or `TransWithoutContext` with statically recoverable keys and defaults. Imported aliases, member calls such as `i18n.t`, dynamic keys or prefixes, and CommonJS are not extraction forms.

Codegen writes standard i18next resources under `node_modules/.gtkx` and augments the `I18nResources` interface exported by `@gtkx/i18n`. That interface supplies i18next's `CustomTypeOptions`, so the upstream `t`, hook, and component types reject unknown literal keys, missing interpolation values, plurals without a numeric `count`, and contextual calls without their literal context. GTKX does not maintain a separate message registry.

Run codegen after adding or changing a source message so the catalog template, every listed PO file, and the TypeScript declarations stay in sync.

## Development and builds

`gtkx dev` synchronizes and compiles the listed PO files into a retained temporary locale tree before loading the application. A change to `LINGUAS` or a PO file triggers a full process restart because libc caches gettext catalogs process-wide.

`gtkx build` writes catalogs beside the bundle:

```text
dist/
├─ bundle.mjs
└─ locale/
   └─ fr/
      └─ LC_MESSAGES/
         └─ com.example.Tasks.mo
```

GTKX initializes libc's locale, binds the application domain, and initializes the i18next backend before the entry module runs. A direct build finds the sibling `locale` directory automatically. Select the locale through the normal process environment before starting the app, for example:

```bash
LANG=fr_FR.UTF-8 LANGUAGE=fr npm run dev
```

The gettext locale is process-global and fixed at startup. Calling an upstream language-changing API cannot change libc's active locale after the process starts.

## Deploy metadata

The same PO files localize the metadata generated by `gtkx deploy`. Deploy initializes any catalog newly listed in `LINGUAS`, extracts the current name, summary, description, and MIME descriptions into the POT, synchronizes every listed PO file, recompiles the catalogs, and then passes them to `msgfmt` to produce `Name[fr]` in the desktop entry and `xml:lang="fr"` elements in XML files. A translation added before that deploy is therefore available to both the application and its generated metadata in the same package.

`gtkx deploy --skip-build` leaves the POT and PO files untouched. It recompiles the existing listed catalogs and packages the already-built application, which makes the flag safe for reproducing a package without changing translator sources. Every locale listed in `LINGUAS` must already have a PO file when this flag is used; run a normal deploy to initialize a newly listed locale.

Compiled catalogs are installed under `share/locale`. The generated launcher derives the actual install prefix at runtime and sets `GTKX_LOCALE_DIR`, so the same bundle works below `/usr` in deb, rpm, and AppImage packages, below `/app` in Flatpak, and at an AppImage's arbitrary mount point. Applications normally never set this implementation variable themselves.

## Next

See [Deploying](/v2/guide/deploying) for package formats and source-mode Flatpak builds, or the [`@gtkx/i18n` API reference](/v2/reference/@gtkx/i18n/) for the exported react-i18next surface.
