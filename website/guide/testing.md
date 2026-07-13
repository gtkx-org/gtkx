# Testing the App

Because GTKX renders real GObject widgets, you can test a GTKX app much the way you test a React web app: render it, query the accessibility tree, drive it with user events, and assert on the result. The [`@gtkx/testing`](https://github.com/gtkx-org/gtkx/tree/main/packages/testing) package provides a React Testing Library style API over the live widget tree, and `@gtkx/vitest` wires it into Vitest.

::: info
The examples below are illustrative, they show the kind of tests you would add to the app. The starter does not ship with them.
:::

## Rendering and querying

`render` mounts the component and returns a `screen` you query by role, name, or text. The names and roles come from the accessibility metadata you set in the components (the `accessibleLabel` and `accessibleRole` props from the [Task Rows](/guide/task-rows-and-reordering) chapter), so well-labelled UI is testable UI.

```tsx
import { render, screen, userEvent } from "@gtkx/testing";
import * as Gtk from "@gtkx/gi/gtk";
import { App } from "../src/app.js";

it("marks a task complete", async () => {
  await render(<App />);

  const checkboxes = await screen.findAllByRole("checkbox");
  await userEvent.click(checkboxes[0]);

  expect(checkboxes[0].active).toBe(true);
});
```

`userEvent.click` synthesizes a real click on the widget, which runs the same `onToggled` handler the app uses in production. The assertion reads the live `active` property off the `Gtk.CheckButton`.

## Driving a flow

Queries and events compose into full flows. Opening a task and checking that the editor appears:

```tsx
it("opens the editor when a task is activated", async () => {
  await render(<App />);

  const row = await screen.findByText("Water the plants");
  await userEvent.click(row);

  expect(await screen.findByText("Notes")).toBeDefined();
});
```

Adding a task through the inline entry row:

```tsx
it("adds a task from the entry row", async () => {
  await render(<App />);

  const entry = await screen.findByRole("text");
  await userEvent.type(entry, "Book flights\n");

  expect(await screen.findByText("Book flights")).toBeDefined();
});
```

## Drag and drop

`@gtkx/testing` can even synthesize the drag-to-reorder gesture from the [Task Rows](/guide/task-rows-and-reordering) chapter. `userEvent.dragAndDrop` verifies the source's `GtkDragSource`, then delivers the payload to the target's `GtkDropTarget` as a marshalled `GObject.Value`:

```tsx
it("reorders tasks by dragging", async () => {
  await render(<App />);

  const first = await screen.findByText("Water the plants");
  const second = await screen.findByText("Review pull requests");
  await userEvent.dragAndDrop(first, second, "the-dragged-task-id");

  const rows = screen.getAllByRole(Gtk.AccessibleRole.LIST_ITEM);
  // assert the new order...
});
```

## Inspecting a running app

For interactive debugging rather than automated assertions, `@gtkx/mcp` exposes the running app to an MCP client: an agent (or you) can list windows, dump the widget tree, query widgets, take screenshots, and click or type. `gtkx dev` starts the MCP client automatically, so a running dev session is inspectable out of the box.

## Next

The app is complete and tested. The last step is [Packaging and Shipping](/guide/packaging).
