---
description: "Test Tasks through real native widgets in an isolated headless session."
---

# Appendix A: Testing the App

The [reminders chapter](/tutorial/reminders) completed the app. Use `@gtkx/testing` to exercise it through the native accessibility tree, with real Adwaita widgets and no visible test window.

## Isolate the application data

The scaffold already configures the GTKX Vitest plugin. Add a setup file and select English for the test process in `vitest.config.ts`:

```ts
import gtkx from "@gtkx/cli/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        include: ["tests/**/*.test.{ts,tsx}"],
        setupFiles: ["./tests/setup.ts"],
        bail: 1,
        env: {
            LANG: "C.UTF-8",
            LANGUAGE: "en",
            LC_ALL: "C.UTF-8",
        },
    },
});
```

Create `tests/setup.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach } from "vitest";
import { applicationId } from "virtual:gtkx-config";

const dataHome = mkdtempSync(join(tmpdir(), "gtkx-tutorial-"));
process.env.XDG_DATA_HOME = dataHome;

const { useStore } = await import("../src/store/index.js");
const { seedLists, seedTasks } = await import("../src/store/seed.js");

beforeEach(() => {
    rmSync(join(dataHome, applicationId), { recursive: true, force: true });
    useStore.setState({
        tasks: seedTasks,
        lists: seedLists,
        collapsed: false,
        filter: "all",
        searchMode: false,
        searchQuery: "",
        dialog: { kind: "none" },
    });
});

afterAll(() => {
    rmSync(dataHome, { recursive: true, force: true });
});
```

Set the data directory before importing the store: its storage backend reads that path during initialization. Each test resets the app's data; mounting a new `App` supplies a fresh navigation container. GTKX cleans up rendered trees between tests. The explicit locale keeps queries consistent when the app gains translations later.

## Drive the widgets

Create `tests/tasks.test.tsx`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";

describe("Tasks", () => {
    it("adds a task through the entry row", async () => {
        await render(<App />, { container: rootElement });

        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "Book flights");
        await userEvent.keyboard(entry, "{Enter}");

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Book flights" })).toBeDefined();
    });

    it("keeps an unnamed list from being submitted", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New List" }));
        const name = await screen.findByPlaceholderText("List name");
        await userEvent.type(name, "   ");

        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Add" })).toBeDisabled();
    });

    it("rejects dragging while the task list is filtered", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByText("Open"));
        const source = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
        const target = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Review pull requests/ });

        await expect(userEvent.dragAndDrop(source, target, "t2")).rejects.toThrow();
    });
});
```

`App` returns an `AdwApplication`, so mount it at `rootElement` rather than inside the default harness window. Await rendering and interactions so assertions observe the resulting GTK state.

Queries use `Gtk.AccessibleRole` and the widget's accessible name. `findByRole` waits for a widget; `queryByRole` returns `null` when it is absent. Keyboard input takes its target widget as the first argument.

These cases cover an ordinary interaction, a blank input, and an unavailable drag operation. The drag payload is the task ID supplied by the app's `GtkDragSource`.

## Run and inspect

```bash
npm test
```

Each worker gets its own runtime directory, session bus, and headless compositor. The development window can stay open while the tests run.

Use `screen.debug()` to inspect the current widget tree or `screen.logRoles()` to inspect accessible names. Check the query and the rendered state when a test fails; assert the expected behavior without depending on diagnostic text.

The [testing guide](/guide/testing) covers scoped queries, hooks, screenshots, and additional interactions. For Vitest configuration and assertions, use the [Vitest documentation](https://vitest.dev/guide/).

## Next

[Making It a Real Application](/tutorial/packaging) adds the icon, desktop metadata, and installable packages.
