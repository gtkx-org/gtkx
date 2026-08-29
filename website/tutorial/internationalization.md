---
description: "Translate the Tasks app and its desktop metadata with react-i18next and GNU gettext."
---

# Speaking the User's Language

[Appendix B: Making It a Real Application](/tutorial/packaging) produced installable packages. This chapter gives the interface, notifications, starter content, and package metadata one French catalog.

`@gtkx/i18n` uses the real i18next singleton and re-exports `react-i18next`. GTKX connects those APIs to the GNU gettext catalog that GLib loads at runtime.

## Set up gettext

Install the package and GNU gettext 0.25 or newer:

```bash
npm install @gtkx/i18n
gettext --version
```

Create an empty `po/LINGUAS`. The application ID, `com.gtkx.tutorial`, is the gettext domain; no locale belongs in `gtkx.config.ts`.

## Translate the interface

Inside components, use the exact `useTranslation` name so `i18next-cli` can extract its `t` calls. In `src/components/window.tsx`:

```tsx
import { useTranslation } from "@gtkx/i18n";

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
```

Translate prose that the application authors: labels, placeholders, tooltips, accessible names, dialogs, toasts, notifications, and starter content. Keep identifiers such as action names, routes, icon names, settings keys, application IDs, and accelerators unchanged. User-entered data also stays unchanged.

The bound `t` export is convenient outside a component. In `src/format.ts`, use i18next interpolation and one/other defaults:

```ts
import { t } from "@gtkx/i18n";

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

The two defaults become one GNU gettext plural entry. Each locale's `Plural-Forms` rule selects the result, and the translator can move `{{count}}` within either form.

The same direct API works in the store and notification modules:

```ts
description: t("No tasks match “{{query}}”", { query }),
```

```ts
notification.setBody(t("Due {{date}}", { date: formatDateTime(task.due) }));
```

Starter content is translated once when it is created and then becomes user data. A later locale change must not rewrite a task the user may have edited.

## Build the catalog

Declare French in `po/LINGUAS`:

```text
fr
```

Run a deploy preview:

```bash
npm run deploy -- --print-manifests
```

The CLI extracts exact `t`, `useTranslation`, `Trans`, and `TransWithoutContext` forms, writes `POTFILES.in` and the POT, initializes `po/fr.po`, adds deploy metadata, and synchronizes the catalog. Imported aliases, member calls, dynamic keys, and CommonJS are not catalog declarations in GTKX 2.

Fill the `msgstr` values in `po/fr.po`:

```po
msgid "Tasks"
msgstr "Tâches"

msgid "New Task (Ctrl+N)"
msgstr "Nouvelle tâche (Ctrl+N)"

msgid "No tasks match “{{query}}”"
msgstr "Aucune tâche ne correspond à « {{query}} »"

msgid "{{count}} day ago"
msgid_plural "{{count}} days ago"
msgstr[0] "Il y a {{count}} jour"
msgstr[1] "Il y a {{count}} jours"
```

Commit `LINGUAS`, `POTFILES.in`, the POT, and the PO files. MO files and `dist/locale` are reproducible build outputs. Let `gtkx codegen`, `gtkx dev`, `gtkx build`, and `gtkx deploy` run `msginit`, `msgmerge`, and `msgfmt` rather than invoking those tools yourself.

Codegen also writes an upstream i18next resource declaration under `node_modules/.gtkx`. It types the keys and options through i18next's `CustomTypeOptions`; GTKX no longer maintains a separate strict message registry.

## Run it in French

Use a fresh data directory so the starter tasks come from the French catalog:

```bash
LANG=fr_FR.UTF-8 \
LANGUAGE=fr \
XDG_DATA_HOME="$(mktemp -d)" \
npm run dev
```

The window title reads **Tâches** and **Water the plants** becomes **Arroser les plantes**. Search for `introuvable` to exercise interpolation.

GLib and libc cache gettext catalogs process-wide. Restart after changing `LANG`, `LC_ALL`, or `LANGUAGE`; changing i18next's language cannot replace the process locale.

## Test the compiled catalog

Keep localization in a separate process from the English suite. `vitest.i18n.config.ts` points that process at the built catalog:

```ts
import gtkx from "@gtkx/cli/vitest-plugin";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        include: ["tests/**/*.i18n.tsx"],
        setupFiles: ["./tests/setup.ts"],
        env: {
            GTKX_LOCALE_DIR: resolve(import.meta.dirname, "dist/locale"),
            LANG: "fr_FR.UTF-8",
            LANGUAGE: "fr",
            LC_ALL: "fr_FR.UTF-8",
        },
    },
});
```

Run the build before that test process:

```json
{
    "scripts": {
        "test": "vitest run && npm run test:i18n",
        "test:i18n": "gtkx build && vitest run --config vitest.i18n.config.ts"
    }
}
```

The tutorial's localized integration test renders the real application and observes French controls, starter content, interpolation, and a plural through native GTK widgets.

## Ship it

Run the normal release command:

```bash
npm run deploy
```

The Node.js 26.7-or-newer ESM bundle and its catalog are staged together. Deb and rpm install the MO below `/usr/share/locale`, Flatpak uses `/app/share/locale`, and AppImage carries the same tree below its mount point. The launcher selects the installed prefix, so application code contains no package-specific locale path.

The same PO file produces localized desktop and AppStream metadata, including `Name[fr]=Tâches` and `<name xml:lang="fr">Tâches</name>`.

## Next

[Shipping It on Flathub](/tutorial/flatpak) builds the localized Flatpak in a sandbox and prepares its source-mode submission.
