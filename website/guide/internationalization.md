---
title: "Internationalization"
description: "Localize a GTKX application and its desktop metadata with react-i18next and GNU gettext."
---

# Internationalization

`@gtkx/i18n` connects `i18next` and `react-i18next` to GNU gettext. Application code uses the upstream APIs, translators edit PO files, and GLib reads compiled MO catalogs at runtime. The same catalog localizes the application and the metadata produced by `gtkx deploy`.

GTKX 2 requires Node.js 26.7 or newer, GNU gettext 0.25 or newer, and ESM application code.

```bash
npm install @gtkx/i18n
gettext --version
```

The application ID from `gtkx.config.ts` is the gettext domain. There is no separate locale configuration.

## Create a catalog

Create `po/LINGUAS` and list one locale per line:

```text
fr
de
```

Add a source message and run codegen:

```tsx
import { t } from "@gtkx/i18n";

const title = t("Tasks");
```

```bash
gtkx codegen
```

GTKX creates `po/<applicationId>.pot`, initializes missing PO files, and writes `po/POTFILES.in`. Commit those files. Edit only the `msgstr` values in the PO files; codegen, development, builds, and deploys own extraction and synchronization.

## Write messages

Interpolation uses i18next's `{{name}}` syntax:

```tsx
<GtkLabel label={t("Hello, {{name}}!", { name: profile.name })} />;
```

Use i18next's one/other defaults for cardinal plurals. GNU gettext selects the translated form from the catalog's `Plural-Forms` rule:

```tsx
const label = t("{{count}} file", {
    count: files.length,
    defaultValue_one: "{{count}} file",
    defaultValue_other: "{{count}} files",
});
```

Use `context` when the same source text needs different translations:

```tsx
const command = t("Open", { context: "menu" });

const apples = t("{{count}} apple", {
    context: "fruit",
    count,
    defaultValue_one: "{{count}} apple",
    defaultValue_other: "{{count}} apples",
});
```

Gettext cardinal entries cannot represent i18next ordinal or zero-specific plural defaults. Keep those messages to one/other forms.

## Use react-i18next

The package re-exports `react-i18next` and shares its default i18next singleton:

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

See the [react-i18next documentation](https://react.i18next.com/) for hooks, providers, and components, and the [`@gtkx/i18n` reference](/reference/@gtkx/i18n/) for exports.

## Keep extraction static

GTKX delegates source scanning to `i18next-cli`. Catalog-owning code must use the exact names `t`, `useTranslation`, `Trans`, or `TransWithoutContext` with statically recoverable keys and defaults. Imported aliases, member calls such as `i18n.t`, dynamic keys or prefixes, and CommonJS are not extraction forms.

Use namespaces only to organize the i18next API. Gettext still has one process-wide application domain.

Codegen writes a standard i18next resource declaration under `node_modules/.gtkx`. This gives consumers upstream key and option typing without a GTKX-specific registry. See [i18next's TypeScript guide](https://www.i18next.com/overview/typescript) for the type model.

Run codegen after changing messages so resources and catalogs stay aligned.

## Run and ship

`gtkx dev` and `gtkx build` compile every locale in `LINGUAS`. A build places catalogs beside the ESM bundle:

```text
dist/
├─ bundle.mjs
└─ locale/
   └─ fr/
      └─ LC_MESSAGES/
         └─ com.example.Tasks.mo
```

Choose the locale before starting the process:

```bash
LANG=fr_FR.UTF-8 LANGUAGE=fr npm run dev
```

The gettext locale is process-wide and fixed at startup. Restart after changing `LANG`, `LC_ALL`, or `LANGUAGE`.

`gtkx deploy` adds translatable desktop, AppStream, and MIME metadata to the same catalogs, compiles them, and installs them under `share/locale`. `--skip-build` packages existing catalogs without changing POT or PO sources.

See [Deploying](/guide/deploying) for packaging.
