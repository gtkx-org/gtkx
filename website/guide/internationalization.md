---
title: "Internationalization"
description: "Translate GTKX applications and package metadata with gettext catalogs."
---

# Internationalization

`@gtkx/i18n` connects React translation APIs to GNU gettext. Your application's `applicationId` is its gettext domain, and `po/` holds its translation catalogs. GTKX uses those catalogs for both the application and its desktop metadata.

Install `@gtkx/i18n@1.6.0` and the GNU gettext command-line tools. On Fedora 44:

```bash
npm install @gtkx/i18n@1.6.0
sudo dnf install gettext
xgettext --version
msgfmt --version
```

Other distributions may package the tools separately; both commands must be available when running codegen, development, and builds.

## Create a catalog

Add `po/LINGUAS` at the project root, with one locale per line:

```text
fr
```

Write source messages with `t`:

```tsx
import { t } from "@gtkx/i18n";
import { GtkLabel } from "@gtkx/jsx/gtk";

<GtkLabel label={t("Hello, {{name}}!", { name: profile.name })} />;
```

Run codegen:

```bash
gtkx codegen
```

GTKX creates `po/<applicationId>.pot`, initializes the listed PO files, and generates translation types. Translators edit each catalog's `msgstr` values. Run codegen again after changing messages to update the template and merge those changes into the catalogs. Review fuzzy entries before release; removed messages remain as obsolete entries.

## Plurals and context

For a plural message, provide the singular and plural source strings through `defaultValue_one` and `defaultValue_other`:

```tsx
const label = t("{{count}} file", {
    count: files.length,
    defaultValue_one: "{{count}} file",
    defaultValue_other: "{{count}} files",
});
```

Gettext chooses the translated form using the catalog's plural rule. Counts must be non-negative; numeric counts must be safe integers. GTKX extraction requires both source forms and rejects i18next options that cannot be represented by this gettext entry, such as ordinal plurals and zero-specific defaults.

Use `context` when the same source text has different meanings:

```tsx
const command = t("Open", { context: "menu command" });
```

A missing contextual entry falls back to the ordinary message. A missing message uses its source text or `defaultValue`.

## Use translations in components

Import the React APIs from `@gtkx/i18n` so they use the configured gettext backend:

```tsx
import { useTranslation } from "@gtkx/i18n";
import { GtkLabel } from "@gtkx/jsx/gtk";

function Greeting({ name }: { name: string }) {
    const { t } = useTranslation();

    return <GtkLabel label={t("Hello, {{name}}!", { name })} />;
}
```

See [react-i18next's documentation](https://react.i18next.com/latest/usetranslation-hook) for its React APIs and [i18next's formatting guide](https://www.i18next.com/translation-function/formatting) for interpolation and formatting. GTKX supplies the catalog integration; gettext still uses one process-wide application domain.

## Keep messages extractable

Keep message keys, defaults, contexts, and `Trans` children static so GTKX can extract them at build time. GTKX follows ESM imports and aliases from `@gtkx/i18n` and `i18next`. Dynamic keys and tagged templates cannot be extracted.

Generated declarations under `node_modules/.gtkx` let TypeScript check message keys and their required interpolation, count, and context options. Run codegen after adding messages; do not edit the declarations.

## Develop and build

`gtkx dev` prepares the catalogs before loading your application. Source saves update the template and translation types before Fast Refresh; they leave translator-owned PO files alone. Run codegen or a build to merge source changes into those files. Saving a PO file or `LINGUAS` restarts the application because gettext caches catalogs for the lifetime of the process.

`gtkx build` compiles the catalogs into `dist/locale` beside the bundle. GTKX initializes localization before the application entry module runs and locates that directory automatically.

Select the process locale before launch:

```bash
LANG=fr_FR.UTF-8 LANGUAGE=fr gtkx dev
```

Gettext translations follow the startup environment. Changing i18next's language does not change libc's active gettext locale; restart the process to change the application's translation language.

## Translate package metadata

A normal `gtkx deploy` refreshes the catalog with application and metadata messages, then compiles and packages the translations. The same PO files supply desktop-entry names, AppStream text, and MIME descriptions.

`gtkx deploy --skip-build` packages the existing build and recompiles existing catalogs without updating PO files. Every locale in `LINGUAS` must already have a catalog. Packaged launchers locate the installed catalogs automatically.

See [Deploying](/guide/deploying) for the packaging workflow.
