---
description: "Test real GTK widgets with @gtkx/testing: Testing Library style queries, user events, Vitest wiring, and MCP inspection of a live app."
---

# Testing the App

Because GTKX renders real GObject widgets, you can test a GTKX app much the way you test a React web app: render it, query the accessibility tree, drive it with user events, and assert on the result. The [`@gtkx/testing`](https://github.com/gtkx-org/gtkx/tree/main/packages/testing) package provides a React Testing Library style API over the live widget tree, and `@gtkx/vitest` wires it into Vitest.

::: info
The examples below are illustrative, they show the kind of tests you would add to the app. The starter does not ship with them.
:::

## Rendering and querying

`render` mounts a tree and gives you a `screen` you query by role, name, or text. Because `App` is itself an `AdwApplication` (not a plain widget), render it into the top-level `rootElement`. Passing no container instead mounts into a throwaway `Gtk.Window`, which cannot host an application.

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { render, screen, userEvent } from "@gtkx/testing";
import { App } from "../src/app.js";

it("marks a task complete", async () => {
  await render(<App />, { container: rootElement });

  const checkbox = screen.getAllByRole(Gtk.AccessibleRole.CHECKBOX)[0] as Gtk.CheckButton;
  await userEvent.click(checkbox);

  expect(checkbox.getActive()).toBe(true);
});
```

Every task row exposes a `GtkCheckButton` with `accessibleLabel="Mark complete"` (from the [Task Rows](/tutorial/task-rows-and-reordering) chapter), and a check button reports the `CHECKBOX` role, so `getAllByRole(Gtk.AccessibleRole.CHECKBOX)` returns one per task. `userEvent.click` runs the same `onToggled` handler the app uses in production, and the assertion reads the live `active` property off the `Gtk.CheckButton`.

`screen` exposes the full query family. `findBy*` waits for a match and is async, `getBy*` and `getAllBy*` return immediately and throw when nothing matches, and `queryBy*` returns `null` instead of throwing. The ones you reach for most:

- `findByText` / `findAllByText`: match a widget's rendered label text.
- `findByRole` / `getAllByRole`: match an accessible role, always a `Gtk.AccessibleRole` value (never a string), optionally narrowed by `{ name }`, `{ checked }`, `{ selected }`, and similar. The `name` option matches the accessible name, which comes from an `accessibleLabel` or from a container's child labels.
- `findByName`: match a widget's `name` property, the value you set with the `name` prop, when you want to grab one specific widget directly.

## Driving a flow

Queries and events compose into full flows. Task rows are `AdwActionRow`s, which report the `LIST_ITEM` role and take their accessible name from the title, so a regular expression matches the row without the exact markup. Each row wires `onActivated`, so firing its `activated` signal opens the detail pane, which renders a "Notes" heading:

```tsx
import { fireEvent } from "@gtkx/testing";

it("opens the detail view when a task is activated", async () => {
  await render(<App />, { container: rootElement });

  const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
  await fireEvent(row, "activated");

  expect(await screen.findByText("Notes")).toBeDefined();
});
```

Adding a task through the inline entry row. The `AdwEntryRow` surfaces its editable with the `TEXT_BOX` role (the search entry stays hidden, and therefore out of the accessibility tree, until you start a search). `userEvent.type` inserts text, then `userEvent.keyboard` presses Enter, which activates the entry and fires the `onEntryActivated` handler:

```tsx
it("adds a task from the entry row", async () => {
  await render(<App />, { container: rootElement });

  const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
  await userEvent.type(entry, "Book flights");
  await userEvent.keyboard(entry, "{Enter}");

  expect(await screen.findByText("Book flights")).toBeDefined();
});
```

## Drag and drop

`@gtkx/testing` can even synthesize the drag-to-reorder gesture from the [Task Rows](/tutorial/task-rows-and-reordering) chapter. Every row carries a `GtkDragSource` and `GtkDropTarget` whenever manual sort order is active, which is the default. `userEvent.dragAndDrop` verifies the source's drag source, then delivers the payload to the target's drop target as a marshalled `GObject.Value`. A string argument is wrapped in a `TYPE_STRING` value, which is exactly what the row's `onDrop` reads back with `value.getString()`:

```tsx
it("reorders tasks by dragging", async () => {
  await render(<App />, { container: rootElement });

  const source = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
  const target = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Review pull requests/ });
  await userEvent.dragAndDrop(source, target, "t2");

  const rows = screen.getAllByRole(Gtk.AccessibleRole.LIST_ITEM);
  // assert the new order from rows...
});
```

The third argument is the dragged task's id, the same value the row's `GtkDragSource` provides in production.

## Inspecting a running app

For interactive debugging rather than automated assertions, `@gtkx/mcp` is an MCP server that an agent (or you, through any MCP client) can drive to list running apps, dump the widget tree, query widgets, take screenshots, fire events, and click or type. `gtkx dev` connects the running app to it automatically, so a dev session is inspectable out of the box.

## Next

The app is complete and tested. The last step is [Packaging and Shipping](/tutorial/packaging).
