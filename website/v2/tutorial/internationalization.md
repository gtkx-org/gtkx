---
description: "Translate the interface and package metadata with GTKX's gettext integration."
---

# Speaking the User's Language

The [packaging chapter](/v2/tutorial/packaging) made Tasks installable. Add a French catalog for its interface and desktop metadata.

`@gtkx/i18n` connects react-i18next to GNU gettext. Components use the upstream [translation hook](https://react.i18next.com/latest/usetranslation-hook); GTKX extracts messages, generates their types, and loads the compiled catalog through GLib.

## Add the catalog

Install the integration:

```bash
npm install @gtkx/i18n@beta
```

GTKX requires GNU gettext 0.25 or newer for extraction and compilation. Its CLI reports missing build tools and installation instructions.

Create `po/LINGUAS` with the locales to ship:

```text
fr
```

The application ID, `com.gtkx.tutorial`, is the gettext domain. Keep it unchanged so the app, catalogs, and package metadata agree.

## Mark the interface text

In `src/components/window.tsx`, import `useTranslation` from `@gtkx/i18n` and call `const { t } = useTranslation()` inside `Window`. Change the existing window title to `title={t("Tasks")}` and the new-task button's tooltip to `tooltipText={t("New Task (Ctrl+N)")}`.

Update `src/components/search-button.tsx`:

```tsx
import { useTranslation } from "@gtkx/i18n";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";

export const SearchButton = () => {
    const { t } = useTranslation();
    const searchMode = useStore((state) => state.searchMode);
    const setSearchMode = useStore((state) => state.setSearchMode);

    return (
        <GtkButton
            iconName="system-search-symbolic"
            tooltipText={t("Search (Ctrl+F)")}
            onClicked={() => setSearchMode(!searchMode)}
        />
    );
};
```

Add the same hook inside `TaskList`, then change its search entry to `placeholderText={t("Search tasks…")}`.

Outside components, import `t` directly from `@gtkx/i18n`. In `src/store/seed.ts`, wrap the starter title as `t("Water the plants")`. In the search result returned by `emptyState` in `src/store/selectors.ts`, replace the description with:

```ts
description: t("No tasks match “{{query}}”", { query }),
```

Replace `src/format.ts` with the tutorial's [translated date helpers](https://github.com/gtkx-org/gtkx/blob/main/examples/tutorial/src/format.ts). This keeps its existing exports and adds the plural message used by the test below. Gettext counts must be non-negative safe integers.

These edits provide the messages exercised in this chapter. Apply the same approach to the remaining authored labels, dialogs, notifications, and starter content; the [finished source](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial/src) shows each location. Keep user-entered names, action names, settings keys, and other identifiers unchanged. Starter content is translated on first creation; changing locale does not rewrite saved tasks.

Use literal message keys and retain the names `t` and `useTranslation`: GTKX's extractor rejects aliases and dynamic keys. Codegen generates the message and interpolation types, so there is no separate list of keys to maintain.

## Translate the messages

Refresh the source and deployment messages without building packages:

```bash
npm run deploy -- --target appimage,deb,rpm --print-manifests
```

GTKX creates `po/fr.po`, synchronizes it with the source template, and includes the translatable metadata from `gtkx.config.ts`. Edit the following entries in that file, preserving its generated header and plural rule:

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

Translate the remaining entries as you mark more interface text. An empty translation falls back to English. The [gettext manual](https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html) describes the PO format.

`gtkx codegen`, `gtkx dev`, and `gtkx build` refresh the source catalog. Deployment also extracts metadata and stages the compiled catalog with the app. Commit `LINGUAS`, the PO and POT files, and `POTFILES.in`; compiled MO files and `dist/locale` are build outputs.

## Run it in French

Use a new data directory so the seed task is translated on first creation:

```bash
LC_ALL=fr_FR.UTF-8 LANG=fr_FR.UTF-8 LANGUAGE=fr \
XDG_DATA_HOME="$(mktemp -d)" npm run dev
```

Check the **Tâches** window title, **Nouvelle tâche (Ctrl+N)** tooltip, and **Arroser les plantes** task. Search for `introuvable` to see the translated empty state.

The locale is process-wide. Restart after changing the locale environment; calling i18next's language-switching API cannot replace the process locale used by GLib.

## Test the compiled catalog

Keep the English tests from the [testing chapter](/v2/tutorial/testing). Create `vitest.i18n.config.ts` for a separate French process:

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

Create `tests/localization.i18n.tsx`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/i18n";
import { rootElement } from "@gtkx/react";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { useStore } from "../src/store/index.js";

describe("Tasks in French", () => {
    it("renders translated controls and starter content", async () => {
        await render(<App />, { container: rootElement });

        expect(
            await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Nouvelle tâche (Ctrl+N)" }),
        ).toBeDefined();

        expect(
            await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Arroser les plantes/ }),
        ).toBeDefined();
    });

    it("uses French interpolation and plural forms", async () => {
        const due = new Date();
        due.setDate(due.getDate() - 2);
        const tasks = useStore.getState().tasks.map((task) =>
            task.id === "t2" ? { ...task, due: due.toISOString() } : task,
        );
        useStore.setState({ tasks });

        await render(<App />, { container: rootElement });

        expect(await screen.findByText("Il y a 2 jours")).toHaveTextContent("Il y a 2 jours");

        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Rechercher (Ctrl+F)" }));
        const search = await screen.findByPlaceholderText("Rechercher des tâches…");
        await userEvent.type(search, "introuvable");

        expect(await screen.findByText("Aucune tâche ne correspond à « introuvable »")).toHaveTextContent(
            "Aucune tâche ne correspond à « introuvable »",
        );
    });

    it("rejects a plural count gettext cannot represent", () => {
        expect(() =>
            t("{{count}} day ago", {
                count: 1.5,
                defaultValue_one: "{{count}} day ago",
                defaultValue_other: "{{count}} days ago",
            }),
        ).toThrow();
    });
});
```

The tests mount the real app, exercise translated controls and empty results, and reject a fractional gettext count. They use the setup file from the testing chapter, including its isolated data directory.

Update these scripts in `package.json`:

```json
{
    "scripts": {
        "test": "vitest run && npm run test:i18n",
        "test:i18n": "gtkx build && vitest run --config vitest.i18n.config.ts"
    }
}
```

```bash
npm test
```

The build compiles `dist/locale/fr/LC_MESSAGES/com.gtkx.tutorial.mo` before the French worker loads it.

## Ship the translations

Rebuild the packages from the previous chapter:

```bash
npm run deploy -- --target appimage,deb,rpm
```

Reinstall the deb or rpm if using it, then launch Tasks in French:

```bash
LC_ALL=fr_FR.UTF-8 LANG=fr_FR.UTF-8 LANGUAGE=fr gtkx-tutorial
```

For the x64 AppImage:

```bash
LC_ALL=fr_FR.UTF-8 LANG=fr_FR.UTF-8 LANGUAGE=fr \
./build/out/Tasks-1.0.0-x86_64.AppImage
```

The launcher locates the packaged catalog through `GTKX_LOCALE_DIR`. Translated metadata, including the application name, is written into the desktop entry and AppStream file. Optional screenshots and release notes use the same PO catalog when present in the deploy configuration.

## Next

[Shipping It on Flathub](/v2/tutorial/flatpak) builds the localized Flatpak and prepares its source submission.
