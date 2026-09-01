---
title: "Internationalization"
description: "Localize application strings and desktop metadata with gettext."
---

# Internationalization

`@gtkx/i18n` connects i18next and react-i18next to GNU gettext. The application ID is the gettext domain.

```bash
npm install @gtkx/i18n
gettext --version
```

GTKX 2 requires GNU gettext 0.25 or later.

## Create and use a catalog

List one locale per line in `po/LINGUAS`, then add messages and run `gtkx codegen`:

```tsx
import { t } from "@gtkx/i18n";

const title = t("Tasks");
const greeting = t("Hello, {{name}}!", { name });
const files = t("{{count}} file", {
    count,
    defaultValue_one: "{{count}} file",
    defaultValue_other: "{{count}} files",
});
```

Codegen creates the POT template, initializes missing PO files, updates `POTFILES.in`, and generates resource types. Commit those files and edit only PO `msgstr` values.

GTKX uses i18next's `{{name}}` interpolation and one/other cardinal plurals. Use `context` when identical source text needs different translations. Gettext cardinal entries cannot represent i18next ordinal or zero-specific plural defaults.

Use `useTranslation` and `Trans` from `@gtkx/i18n` when components need react-i18next. The package shares the default i18next singleton; see the [react-i18next guide](https://react.i18next.com/) for providers and hooks.

## Keep extraction static

Extraction recognizes the exact names `t`, `useTranslation`, `Trans`, and `TransWithoutContext` with static keys and defaults. Aliases, `i18n.t`, dynamic keys or prefixes, and CommonJS are not extractable forms. Run codegen after changing messages.

## Run and package a locale

```bash
LANG=fr_FR.UTF-8 LANGUAGE=fr npm run dev
```

The gettext locale is process-wide and fixed at startup. `gtkx dev` and `gtkx build` compile locales beside the bundle; `gtkx deploy` also extracts translated desktop, AppStream, and MIME metadata and installs catalogs under `share/locale`.

See the [`@gtkx/i18n` reference](/reference/@gtkx/i18n/) for exports and [Deploying](/guide/deploying) for packaging.
