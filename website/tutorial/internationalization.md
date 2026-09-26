---
description: "Translate the interface and package metadata with GTKX's gettext integration."
---

# Translate the App

[Package the App](/tutorial/packaging) made Tasks installable. Add a French catalog for its interface and desktop metadata.

`@gtkx/i18n` connects react-i18next to GNU gettext. Components use the upstream [translation hook](https://react.i18next.com/latest/usetranslation-hook); GTKX extracts messages, generates their types, and loads the compiled catalog through GLib.

## Add the catalog

Install the integration:

```bash
npm install @gtkx/i18n@1.6.0
```

GTKX uses GNU gettext for extraction and compilation. Its CLI reports missing build tools and installation instructions.

Create `po/LINGUAS` with the locales to ship:

```text [po/LINGUAS]
fr
```

The application ID, `com.gtkx.tutorial`, is the gettext domain. Keep it unchanged so the app, catalogs, and package metadata agree.

## Mark the interface text

Translate the window title and new-task tooltip in `src/components/window.tsx`:

```diff [src/components/window.tsx]
@@ -0,0 +1 @@
+import { useTranslation } from "@gtkx/i18n";
@@ -36,0 +38 @@
+    const { t } = useTranslation();
@@ -74 +76 @@
-                title="Tasks"
+                title={t("Tasks")}
@@ -121 +123 @@
-                                                tooltipText="New Task (Ctrl+N)"
+                                                tooltipText={t("New Task (Ctrl+N)")}
```

Update `src/components/search-button.tsx`:

```tsx [src/components/search-button.tsx]
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

Translate the search entry in `src/components/task-list.tsx`:

```diff [src/components/task-list.tsx]
@@ -0,0 +1 @@
+import { useTranslation } from "@gtkx/i18n";
@@ -11,0 +13 @@
+    const { t } = useTranslation();
@@ -34 +36 @@
-                    placeholderText="Search tasks…"
+                    placeholderText={t("Search tasks…")}
```

Outside components, import `t` directly. Translate the starter task in `src/store/seed.ts`:

```diff [src/store/seed.ts]
@@ -0,0 +1 @@
+import { t } from "@gtkx/i18n";
@@ -41 +42 @@
-        title: "Water the plants",
+        title: t("Water the plants"),
```

Translate the search result in `src/store/selectors.ts`:

```diff [src/store/selectors.ts]
@@ -0,0 +1 @@
+import { t } from "@gtkx/i18n";
@@ -115 +116 @@
-    if (query) return { icon: "system-search-symbolic", title: "No Results", description: `No tasks match “${query}”` };
+    if (query) return { icon: "system-search-symbolic", title: "No Results", description: t("No tasks match “{{query}}”", { query }) };
```

Translate the formatters in `src/format.ts`, keeping the existing date helpers:

```diff [src/format.ts]
@@ -0,0 +1 @@
+import { t } from "@gtkx/i18n";
@@ -13,4 +14,6 @@
-    if (days === 0) return `Today at ${time}`;
-    if (days === 1) return `Tomorrow at ${time}`;
-    if (days === -1) return `Yesterday at ${time}`;
-    if (days < 0) return `${-days} days ago`;
+    if (days === 0) return t("Today at {{time}}", { time });
+    if (days === 1) return t("Tomorrow at {{time}}", { time });
+    if (days === -1) return t("Yesterday at {{time}}", { time });
+    if (days < 0) {
+        return t("{{count}} day ago", "{{count}} days ago", { count: -days });
+    }
@@ -22 +25 @@
-    if (!iso) return "Never";
+    if (!iso) return t("Never");
```

Gettext counts must be non-negative safe integers. An overdue date has a negative `days` value, so pass `-days` as the count. `toLocaleDateString` and `toLocaleString` format dates using the process locale.

These edits provide the messages exercised in this chapter. Apply the same approach to the remaining authored labels, dialogs, notifications, and starter content; the [finished source](https://github.com/gtkx-org/gtkx/tree/v1.6.0/examples/tutorial/src) shows each location. Keep user-entered names, action names, settings keys, and other identifiers unchanged. Starter content is translated on first creation; changing locale does not rewrite saved tasks.

Use literal message keys and retain the names `t` and `useTranslation`: GTKX's extractor rejects aliases and dynamic keys. Codegen generates the message and interpolation types, so there is no separate list of keys to maintain.

## Translate the messages

Refresh the source and deployment messages without building packages:

```bash
npm run deploy -- --target appimage,deb,rpm --print-manifests
```

GTKX creates `po/fr.po`, synchronizes it with the source template, and includes the translatable metadata from `gtkx.config.ts`. Replace the initial French catalog with this complete file. Later extraction keeps these translations and adds new messages:

```po [po/fr.po]
msgid ""
msgstr ""
"Project-Id-Version: gtkx-tutorial 1.0.0\n"
"PO-Revision-Date: 2026-09-26 00:00+0000\n"
"Last-Translator: GTKX contributors\n"
"Language-Team: French\n"
"Language: fr\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Plural-Forms: nplurals=2; plural=(n > 1);\n"

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

msgid "Today at {{time}}"
msgstr "Aujourd’hui à {{time}}"

msgid "Tomorrow at {{time}}"
msgstr "Demain à {{time}}"

msgid "Yesterday at {{time}}"
msgstr "Hier à {{time}}"

msgid "Never"
msgstr "Jamais"

msgid "{{count}} day ago"
msgid_plural "{{count}} days ago"
msgstr[0] "Il y a {{count}} jour"
msgstr[1] "Il y a {{count}} jours"

msgid "Task Manager"
msgstr "Gestionnaire de tâches"

msgid "Manage your tasks and to-dos"
msgstr "Gérez vos tâches et listes de choses à faire"

msgid "Tasks lets you organize to-dos into lists, set reminders, and track completed work. Built with GTKX, React, and Adwaita."
msgstr "Tâches vous permet d’organiser vos tâches en listes, de définir des rappels et de suivre le travail accompli. L’application utilise GTKX, React et Adwaita."

msgid "Task;Tasks;Todo;To-do;Checklist;"
msgstr "Tâche;Tâches;À faire;À-faire;Liste de contrôle;"

msgid "Task"
msgstr "Tâche"

msgid "Todo"
msgstr "À faire"

msgid "To-do"
msgstr "À-faire"

msgid "Checklist"
msgstr "Liste de contrôle"
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

Keep the English tests from [Test the App](/tutorial/testing). Create `vitest.i18n.config.ts` for a separate French process:

```ts [vitest.i18n.config.ts]
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

```tsx [tests/localization.i18n.tsx]
import * as Gtk from "@gtkx/gi/gtk";
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

    it("rejects dragging while the translated task list is filtered", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByText("Open"));
        const source = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Arroser les plantes/ });
        const target = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Welcome to Tasks/ });

        await expect(userEvent.dragAndDrop(source, target, "t2")).rejects.toThrow();
    });
});
```

The tests mount the real app, exercise translated controls and empty results, and reject an unavailable drag after filtering. They use the setup file from the testing chapter, including its isolated data directory.

Replace the `scripts` field in `package.json` with this block; keep the remaining package fields:

```json [package.json] merge
{
    "scripts": {
        "dev": "gtkx dev",
        "build": "gtkx build",
        "codegen": "gtkx codegen",
        "test": "vitest run && npm run test:i18n",
        "test:i18n": "gtkx build && vitest run --config vitest.i18n.config.ts",
        "typecheck": "gtkx codegen && tsc",
        "start": "node dist/bundle.mjs",
        "deploy": "gtkx deploy"
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

[Prepare for Flathub](/tutorial/flatpak) builds the localized Flatpak and prepares its source submission.
