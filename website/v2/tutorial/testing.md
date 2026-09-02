---
description: "Drive the finished app in headless tests that query the accessibility tree the way a user reaches it."
---

# Appendix A: Testing the App

The app is finished: [Reminders That Reach the Desktop](/v2/tutorial/reminders) added the last feature. This appendix keeps it working by driving the real widgets with no display attached, through the same accessibility tree a screen reader walks. GTKX queries widgets by their GTK4 accessible role and name, so a widget your test cannot reach is usually one an assistive technology cannot reach either. When a query fails, it points to a problem in the interface.

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

The app writes to disk. [Saving Tasks Between Runs](/v2/tutorial/saving-to-disk) pointed `storage.ts` at `XDG_DATA_HOME`, so the tests redirect that one environment variable and the whole persistence layer follows into a temporary directory.

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
        collapsed: false,
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

There is no navigation state in that list, and none is missing. Each `render` builds a new `NavigationContainer`, so every test starts on the `Tasks` route with the `initialParams` from [Smart Views, Filters, and Search](/v2/tutorial/smart-views-and-search): All Tasks in the content pane, the sidebar beside it, and nothing above them. What the store holds is reset by hand, `collapsed` included, since the breakpoint writes that one and a test should not inherit a narrow layout from the test before it.

## Testing the store on its own

Start with the tests that need no widgets. The store is a plain module: call an action, read `getState()`, and assert. They run fast and cover the logic most likely to be wrong.

Create `tests/tasks.test.tsx`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { act, fireEvent, render, screen, userEvent } from "@gtkx/testing";
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

Putting state outside the component tree in [Adding Tasks with a Store](/v2/tutorial/the-task-store) pays off here: proving that `addTask` trims its input and returns an identifier, and that `setDone` stamps `completedAt`, needs no window, no render, and no query. Use a rendered test when the subject is the interface, and this kind when the subject is a rule.

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

## Ticking and opening

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

Several tests start by opening the same task, so that step goes in a helper above both `describe` blocks.

In `tests/tasks.test.tsx`:

```tsx
const openWaterThePlants = async (): Promise<void> => {
    const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
    await fireEvent(row, "activated");
    await screen.findByText("Notes");
};
```

The helper ends on a query rather than on the click. `activated` runs `navigation.navigate("Task", { id })`, and waiting for the editor's Notes label is what makes the following assertions run against the page that push produced.

The first test to use it is the one about the push itself.

In `tests/tasks.test.tsx`:

```tsx
// ...

    it("opens the editor when a row is activated", async () => {
        await render(<App />, { container: rootElement });

        await openWaterThePlants();

        expect(await screen.findByText("Notes")).toHaveTextContent("Notes");
    });
```

This test emits a signal instead of synthesizing input. `userEvent` is still the better default because it drives the same event plumbing as production, and `userEvent.click` on this row would activate it too. Here the handler behind `activated` is what the test is about, so it drives that signal directly: `fireEvent(object, signalName)` emits any GObject signal without actionability checks.

The name matchers are regular expressions rather than strings. A string has to match a whole accessible name, which a row assembles out of everything it shows, so a regular expression is the form that keeps matching when a row grows a subtitle or a badge.

## Moving between pages

Everything so far asserted on one page. These move between them, which is the part of the app you did not write: the navigator draws the back button, answers Escape, and swaps the content pane.

In `tests/tasks.test.tsx`:

```tsx
// ...

    it("goes back to the list from the editor", async () => {
        await render(<App />, { container: rootElement });

        await openWaterThePlants();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ })).toBeDefined();
        expect(screen.queryByText("Notes")).toBeNull();
    });
```

The back button is Adwaita's, and it reaches the tree like any other widget: role `BUTTON`, name `Back`. Nothing in this test waits for an animation, because `render` turns them off unless it is given `areAnimationsEnabled: true`, so a push or a pop has finished by the time the click resolves.

The two assertions are a pair, and they work because only the page on screen is mapped. The task list is queryable again, and the editor is gone from the tree rather than sitting behind it. `queryByText` returns `null` where `findByText` and `getByText` throw, which is how you assert that something left. `userEvent.keyboard(widget, "{Escape}")` pops the same page through the key, if you would rather test the way most people leave the editor.

Selecting a list is the other kind of move: a `navigate` that keeps the same route and swaps its params.

In `tests/tasks.test.tsx`:

```tsx
// ...

    it("shows another list when its sidebar row is selected", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^Work/ }));

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Review pull requests/ })).toBeDefined();
        expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ })).toBeNull();
    });
```

Both panes are on screen, because the setup file leaves `collapsed` at `false`, so `LIST_ITEM` reaches the sidebar's rows and the task list's rows at once. `/^Work/` is anchored so it cannot be answered by a task title that happens to contain the word. The click goes through the list box's own selection, which is where [Lists and a Sidebar](/v2/tutorial/lists-and-the-sidebar) put the `navigate` call, so this test covers the round trip that keeps GTK4's selection and the route in agreement: the click reaches `onRowSelected`, the navigation swaps the route's params, and the `selectedIndex` those params imply is the row the user just clicked, so the highlight stays where they put it.

The New Task button carries no handler at all, only `actionName="win.new"`.

In `tests/tasks.test.tsx`:

```tsx
// ...

    it("opens the editor for a task added with the New Task button", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Task (Ctrl+N)" }));

        expect(await screen.findByText("Notes")).toHaveTextContent("Notes");
        expect(useStore.getState().tasks.some((task) => task.title === "New Task")).toBe(true);
    });
```

Clicking it activates the GAction, which reads the current selection through the container ref from [Menus, Accelerators, and Shortcuts](/v2/tutorial/actions-menus-shortcuts), adds the task, and navigates twice to put the editor over the right list. The two assertions cover both halves: the interface arrived at the editor, and the store holds the task it is editing. `Ctrl+N` ends in the same action, so the only thing the key adds on top of this is the accelerator entry itself.

The last one closes a page without touching the back button.

In `tests/tasks.test.tsx`:

```tsx
// ...

    it("returns to the list when the open task is moved to trash", async () => {
        await render(<App />, { container: rootElement });

        await openWaterThePlants();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete (Delete)" }));

        expect(screen.queryByText("Notes")).toBeNull();
        expect(useStore.getState().tasks.find((task) => task.id === "t2")?.deleted).toBe(true);
    });
```

The trash button in the editor's header runs the hook from [Deleting Without Fear](/v2/tutorial/trash-and-toasts), which pops the page before it moves the task, so the editor is gone by the time the store write lands. Assert both, since a version that trashed the task and left the editor standing over it would still pass the second line on its own.

## Dragging and toggling

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

The third argument to `dragAndDrop` is the payload. It has to match the string your `GtkDragSource` puts in its content provider: the task identifier from [Dragging Tasks Into Order](/v2/tutorial/drag-to-reorder). The assertion reads the rows back in tree order to check they swapped. The seed gives every task a distinct position, so that order is the same on every run.

The last one drives the swatch group from [Deleting Without Fear](/v2/tutorial/trash-and-toasts), where each toggle button past the first joins the first through `group`. Clicking the same swatch twice is the case a plain toggle gets wrong, because the second click would clear it.

In `tests/tasks.test.tsx`:

```tsx
// ...

    it("keeps one color selected when the same swatch is clicked repeatedly", async () => {
        await render(<App />, { container: rootElement });

        await act(() => {
            useStore.getState().showDialog("new-list");
        });

        const orange = await screen.findByLabelText("Color #e66100");
        await userEvent.click(orange);
        await userEvent.click(orange);

        expect(orange).toHaveObjectProperty("active", true);
        expect(await screen.findByLabelText("Color #3584e4")).toHaveObjectProperty("active", false);
    });
```

Opening the dialog is a store write rather than a click, because the button that raises it lives in the sidebar header and this test is about the swatches. That write comes from outside any event the harness drives, so it goes inside `act`, which flushes the render it causes before the query runs. `findByLabelText` reaches each toggle through the `accessibleLabel` the dot carries, and `toHaveObjectProperty` reads a plain GObject property off the widget, which is where a toggle keeps its state.

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
  Name "New List": <Button role="button">New List</Button>
  Name "Delete task": <Button role="button">Delete task</Button>
  Name "Delete task": <Button role="button">Delete task</Button>
  Name "Delete task": <Button role="button">Delete task</Button>
  Name "Delete task": <Button role="button">Delete task</Button>
  Name "Delete task": <Button role="button">Delete task</Button>
  Name "Delete task": <Button role="button">Delete task</Button>
  Name "New Task (Ctrl+N)": <Button role="button">New Task (Ctrl+N)</Button>
  Name "Search (Ctrl+F)": <Button role="button">Search (Ctrl+F)</Button>
  Name "Main Menu": <MenuButton role="button">Main Menu</MenuButton>
  Name "Minimize": <Button role="button">Minimize</Button>
  Name "Maximize": <Button role="button">Maximize</Button>
  Name "Close": <Button role="button">Close</Button>
```

The dump continues through every other role in the window. Read it as an accessibility report, not a stack trace: `Name "Delete task"` appears once per seeded task because [Completing, Starring, and Deleting](/v2/tutorial/completing-and-deleting) gave that icon-only button an `accessibleLabel`, and Minimize, Maximize, and Close are the window controls the header bar draws. Every button here has a name. Further down, under `generic`, the entries reading `Name ""` are the layout boxes, which neither a query nor a screen reader has any reason to reach.

Run the same query after opening Water the plants and that one section reads differently:

```
button:
  Name "New List": <Button role="button">New List</Button>
  Name "Clear due date": <Button role="button">Clear due date</Button>
  Name "Today at 12:00 AM": <MenuButton role="button">Today at 12:00 AM</MenuButton>
  Name "Back": <Button role="button">Back</Button>
  Name "Delete (Delete)": <Button role="button">Delete (Delete)</Button>
  Name "Minimize": <Button role="button">Minimize</Button>
  Name "Maximize": <Button role="button">Maximize</Button>
  Name "Close": <Button role="button">Close</Button>
```

The sidebar is still there, since it is the other pane rather than the other page. Everything belonging to the task list is gone: its rows, its header bar, and the buttons on it, replaced by the editor's own and the back button the navigator added. That is what "only the visible page is mapped" means in practice, and it is why a test asserting that a page closed can look for something that was on it and expect nothing back.

You do not have to fail a query to see this. `screen.debug()` prints the annotated tree at any point in a test, and `screen.logRoles()` prints the same grouping on demand. That is the quickest way to check what role a widget reports before you write the query.

The rest of the harness, including `within`, `renderHook`, `waitFor`, screenshots, and the full matcher set, is in the [testing guide](/v2/guide/testing).

## Run it

Leave the dev server where it is. Each Vitest worker starts its own headless compositor and session bus, so the suite never touches the window you have had open since [the introduction](/v2/tutorial/). Open a second terminal:

```
npm test
```

Every test passes against real GTK4 widgets with no display attached:

```
 RUN  v4.1.10 ~/tasks

[gtkx] Compiled GSettings schema: com.gtkx.tutorial.gschema.xml

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  18:12:36
   Duration  9.35s (transform 6.41s, setup 361ms, import 7.63s, tests 1.14s, environment 0ms)
```

Now break something on purpose. Change the drag payload in the reorder test from `"t2"` to `"t9"` and run again. The test fails, because the drop target looks that identifier up in the store and finds no task, exactly what a mismatched content provider would do in the running app. Put it back and the suite passes again.

## Next

[Appendix B: Making It a Real Application](/v2/tutorial/packaging) turns the project into something the desktop recognizes: an icon, a desktop entry, and a name in the application menu.
