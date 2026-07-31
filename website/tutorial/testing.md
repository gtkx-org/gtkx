---
description: "Drive the finished app in headless tests that query the accessibility tree the way a user reaches it."
---

# Appendix A: Testing the App

The app is finished: [Reminders That Reach the Desktop](/tutorial/reminders) added the last feature. This appendix keeps it working by driving the real widgets with no display attached, through the same accessibility tree a screen reader walks. GTKX queries widgets by their GTK4 accessible role and name, so a widget your test cannot reach is usually one an assistive technology cannot reach either. When a query fails, it points to a problem in the interface.

## Wiring the runner

Tests run under Vitest with the GTKX plugin. For each worker process, it boots a private runtime directory, session bus, and headless compositor before any test code loads. Your widgets are real GTK4 widgets, laid out and rendered off-screen.

The scaffold already put the plugin in place. Add a setup file.

In `vitest.config.ts`:

```diff
     test: {
         include: ["tests/**/*.test.{ts,tsx}"],
+        setupFiles: ["./tests/setup.ts"],
         bail: 1,
     },
```

The app writes to disk. [Saving Tasks Between Runs](/tutorial/saving-to-disk) pointed `storage.ts` at `XDG_DATA_HOME`, so the tests redirect that one environment variable and the whole persistence layer follows into a temporary directory.

Create `tests/setup.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach } from "vitest";

const dataHome = mkdtempSync(join(tmpdir(), "gtkx-tutorial-"));

process.env.XDG_DATA_HOME = dataHome;

const { useStore } = await import("../src/store/index.js");
const { seedLists, seedTasks } = await import("../src/store/seed.js");

beforeEach(() => {
    rmSync(join(dataHome, "com.gtkx.tutorial"), { recursive: true, force: true });
    useStore.setState({
        tasks: seedTasks,
        lists: seedLists,
        selection: { kind: "smart", view: "all" },
        selectedTaskId: null,
        collapsed: false,
        showContent: false,
        filter: "all",
        searchMode: false,
        searchQuery: "",
        dialog: "none",
        taskToDelete: null,
    });
});

afterAll(() => {
    rmSync(dataHome, { recursive: true, force: true });
});
```

The dynamic `await import` is deliberate. ESM hoists static imports above every statement in a module, so a plain `import { useStore } from "../src/store/index.js"` would evaluate `storage.ts` (and read `process.env.XDG_DATA_HOME`) before the assignment above it ran. Importing after the assignment is what makes the redirect take effect.

## Testing the store on its own

Start with the tests that need no widgets. The store is a plain module: call an action, read `getState()`, and assert. They run fast and cover the logic most likely to be wrong.

Create `tests/tasks.test.tsx`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { fireEvent, render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { useStore } from "../src/store/index.js";

describe("the store", () => {
    it("adds a task and completes it", () => {
        const id = useStore.getState().addTask("personal", "  Call the plumber  ");

        expect(id).not.toBeNull();

        const added = useStore.getState().tasks.find((task) => task.id === id);

        expect(added?.title).toBe("Call the plumber");
        expect(added?.done).toBe(false);

        if (id) useStore.getState().setDone(id, true);

        const completed = useStore.getState().tasks.find((task) => task.id === id);

        expect(completed?.done).toBe(true);
        expect(completed?.completedAt).not.toBeNull();
    });
});
```

Putting state outside the component tree in [Adding Tasks with a Store](/tutorial/the-task-store) pays off here: proving that `addTask` trims its input and returns an identifier, and that `setDone` stamps `completedAt`, needs no window, no render, and no query. Use a rendered test when the subject is the interface, and this kind when the subject is a rule.

## Rendering the app

The rest drives the whole application. Append a second `describe` to the same file.

In `tests/tasks.test.tsx`:

```tsx
// ...

describe("Tasks", () => {
    it("adds a task from the entry row", async () => {
        await render(<App />, { container: rootElement });

        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "Book flights");
        await userEvent.keyboard(entry, "{Enter}");

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Book flights" })).toBeDefined();
    });
});
```

`render` is awaited because mounting widgets flushes React's work through a live GTK4 loop. The `container: rootElement` option makes the application testable: `App` returns an `AdwApplication`, which is not a widget and cannot be parented inside a harness window, so it mounts into the top-level root the same way `createRoot()` mounts it in `index.tsx`.

`TEXT_BOX` reaches the add row, `LIST_ITEM` an `AdwActionRow`, `CHECKBOX` a `GtkCheckButton`. These are GTK4's own roles, read live off each widget, so the vocabulary is an enum rather than a string.

The keyboard helper takes its target widget first, unlike its browser counterpart, because there is no document-wide focus to fall back on.

## Ticking, opening, dragging

Add these inside the same `describe`.

In `tests/tasks.test.tsx`:

```tsx
// ...

    it("marks a task complete", async () => {
        await render(<App />, { container: rootElement });

        const [checkbox] = await screen.findAllByRole(Gtk.AccessibleRole.CHECKBOX);
        await userEvent.click(checkbox);

        expect(checkbox).toBeChecked();
    });
```

`toBeChecked` is one of the widget matchers `@gtkx/testing` adds to `expect`. It reads the accessible checked state off the `GtkCheckButton` and throws when the widget does not expose that state, so aiming it at the wrong widget fails instead of passing silently.

In `tests/tasks.test.tsx`:

```tsx
// ...

    it("opens the editor when a row is activated", async () => {
        await render(<App />, { container: rootElement });

        const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
        await fireEvent(row, "activated");

        expect(await screen.findByText("Notes")).toHaveTextContent("Notes");
    });
```

This test emits a signal instead of synthesizing input. `userEvent` is still the better default because it drives the same event plumbing as production, but `activated` on a row has no single gesture behind it, and `fireEvent(object, signalName)` emits any GObject signal without actionability checks. The name matcher is a regular expression because that row's accessible name includes its due-date subtitle along with the title.

In `tests/tasks.test.tsx`:

```tsx
// ...

    it("reorders tasks by dragging", async () => {
        await render(<App />, { container: rootElement });

        const source = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
        const target = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Review pull requests/ });
        await userEvent.dragAndDrop(source, target, "t2");

        const [first, second] = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM, {
            name: /Water the plants|Review pull requests/,
        });

        expect(first).toHaveAccessibleName("Review pull requests");
        expect(second).toHaveAccessibleName("Water the plants");
    });
```

The third argument to `dragAndDrop` is the payload. It has to match the string your `GtkDragSource` puts in its content provider: the task identifier from [Dragging Tasks Into Order](/tutorial/drag-to-reorder). The assertion reads the rows back in tree order to check they swapped. The seed gives every task a distinct position, so that order is the same on every run.

## Reading a failure

When a query finds nothing, the error tells you what the tree actually holds. Ask for a button the app does not have:

```tsx
screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Add task" });
```

and the failure prints the accessible tree grouped by role:

```
ElementError: Unable to find an element with role 'BUTTON' and name 'Add task'

Here are the accessible roles:

button:
  Name "": <Button role="button"></Button>
  Name "New List": <Button role="button">New List</Button>
  Name "": <Button role="button"></Button>
  Name "Apply": <Button role="button">Apply</Button>
  Name "Delete task": <Button role="button">Delete task</Button>
  Name "Delete task": <Button role="button">Delete task</Button>
  Name "": <Button role="button"></Button>
  Name "New Task (Ctrl+N)": <Button role="button">New Task (Ctrl+N)</Button>
  Name "Search (Ctrl+F)": <Button role="button">Search (Ctrl+F)</Button>
  Name "Main Menu": <MenuButton role="button">Main Menu</MenuButton>
```

The dump continues through every other role in the window. Read it as an accessibility report, not a stack trace: `Name "Delete task"` appears once per visible row because [Completing, Starring, and Deleting](/tutorial/completing-and-deleting) gave that icon-only button an `accessibleLabel`, and every entry reading `Name ""` is a widget that neither a query nor a screen reader can name.

You do not have to fail a query to see this. `screen.debug()` prints the annotated tree at any point in a test, and `screen.logRoles()` prints the same grouping on demand. That is the quickest way to check what role a widget reports before you write the query.

The rest of the harness, including `within`, `renderHook`, `waitFor`, screenshots, and the full matcher set, is in the [testing guide](/guide/testing).

## Run it

Leave the dev server where it is. Each Vitest worker starts its own headless compositor and session bus, so the suite never touches the window you have had open since [the introduction](/tutorial/). Open a second terminal:

```
npm test
```

Every test passes against real GTK4 widgets with no display attached:

```
 RUN  v4.1.10 /home/eugenio/gtkx/examples/tutorial

[gtkx] Compiled GSettings schema: com.gtkx.tutorial.gschema.xml

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  18:12:36
   Duration  8.71s (transform 6.38s, setup 358ms, import 7.60s, tests 518ms, environment 0ms)
```

Now break something on purpose. Change the drag payload in the reorder test from `"t2"` to `"t9"` and run again. The test fails, because the drop target looks that identifier up in the store and finds no task, exactly what a mismatched content provider would do in the running app. Put it back and the suite passes again.

## Next

[Appendix B: Making It a Real Application](/tutorial/packaging) turns the project into something the desktop recognizes: an icon, a desktop entry, and a name in the application menu.
