# Testing

GTKX provides testing utilities through `@gtkx/testing`, offering an API similar to Testing Library for React.

## Setup

Install the testing and vitest packages:

```bash
npm install -D @gtkx/testing @gtkx/vitest vitest
```

Create a `vitest.config.ts` file:

```typescript
import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [gtkx()],
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
```

Configure your test script in `package.json`:

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

The `@gtkx/vitest` plugin automatically:

- Starts Xvfb instances for headless display
- Sets required GTK environment variables (`GDK_BACKEND`, `GSK_RENDERER`, etc.)
- Ensures proper display isolation between test workers

The `render()` function from `@gtkx/testing` handles GTK application lifecycle automatically, so no additional setup is needed.

## Basic Test

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { cleanup, render, screen, userEvent } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/app.js";

describe("App", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("renders the window", async () => {
    await render(<App />, { wrapper: false });

    const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, {
      name: "My App",
    });
    expect(window).toBeDefined();
  });
});
```

## Querying Widgets

Find widgets using familiar Testing Library patterns:

```tsx
// By accessible role
const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
  name: "Submit",
});

// By text content
const label = await screen.findByText("Hello World");
const labelRegex = await screen.findByText(/hello/i);

// By test ID (uses the widget's `name` prop)
const input = await screen.findByTestId("email-input");

// Multiple elements
const allButtons = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON);
```

See `Gtk.AccessibleRole` for all available roles.

## User Interactions

Simulate user actions with `userEvent`:

```tsx
import { userEvent } from "@gtkx/testing";

// Click a button
await userEvent.click(button);

// Type text into an input
await userEvent.type(input, "Hello World");

// Clear an input
await userEvent.clear(input);

// Toggle a checkbox
await userEvent.click(checkbox);

// Select a dropdown option
await userEvent.selectOptions(dropdown, 0);
```

## Firing Signals on Event Controllers

Use `fireEvent` to emit signals directly on widgets or event controllers. This is useful for testing gesture handlers and other controller-based interactions:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { Value } from "@gtkx/ffi/gobject";
import { fireEvent } from "@gtkx/testing";

const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);

const gesture = button.observeControllers().getObject(0) as Gtk.GestureDrag;
await fireEvent(
  gesture,
  "drag-begin",
  Value.newFromDouble(100),
  Value.newFromDouble(100),
);
```

The `fireEvent` function accepts both `Gtk.Widget` and `Gtk.EventController` objects, allowing you to test gesture signals like `drag-begin`, `drag-update`, and `drag-end`.

## Scoped Queries

Use `within` to query within a specific widget subtree:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { within } from "@gtkx/testing";

const listItem = await screen.findByTestId("todo-1");
const { findByRole } = within(listItem);

const checkbox = await findByRole(Gtk.AccessibleRole.CHECKBOX);
const deleteButton = await findByRole(Gtk.AccessibleRole.BUTTON);
```

## Debugging

Print the widget tree to the console:

```tsx
await render(<MyComponent />);
screen.debug();
```

This outputs an HTML-like representation of the widget hierarchy:

```
<GtkApplicationWindow role="window">
 <GtkBox role="group">
 <GtkButton data-testid="submit" role="button">
 Submit
 </GtkButton>
 </GtkBox>
</GtkApplicationWindow>
```

## Screenshots

Capture screenshots for visual debugging:

```tsx
// Capture first window
await screen.screenshot();

// Capture window by title
await screen.screenshot("Settings");
```

## Complete Example

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { cleanup, render, screen, userEvent, within } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { TodoApp } from "../src/app.js";

describe("TodoApp", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("adds a new todo", async () => {
    await render(<TodoApp />, { wrapper: false });

    const input = await screen.findByTestId("todo-input");
    const addButton = await screen.findByTestId("add-button");

    await userEvent.type(input, "Buy groceries");
    await userEvent.click(addButton);

    const todoText = await screen.findByText("Buy groceries");
    expect(todoText).toBeDefined();
  });

  it("toggles todo completion", async () => {
    await render(<TodoApp />, { wrapper: false });

    const input = await screen.findByTestId("todo-input");
    await userEvent.type(input, "Test todo");
    await userEvent.click(await screen.findByTestId("add-button"));

    const checkbox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
      checked: false,
    });
    await userEvent.click(checkbox);

    const checkedBox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
      checked: true,
    });
    expect(checkedBox).toBeDefined();
  });

  it("deletes a todo", async () => {
    await render(<TodoApp />, { wrapper: false });

    const input = await screen.findByTestId("todo-input");
    await userEvent.type(input, "Todo to delete");
    await userEvent.click(await screen.findByTestId("add-button"));

    const deleteButton = await screen.findByTestId(/^delete-/);
    await userEvent.click(deleteButton);

    const emptyMessage = await screen.findByText("No tasks yet");
    expect(emptyMessage).toBeDefined();
  });

  it("updates the remaining count", async () => {
    await render(<TodoApp />, { wrapper: false });

    const input = await screen.findByTestId("todo-input");
    const addButton = await screen.findByTestId("add-button");

    await userEvent.type(input, "Todo 1");
    await userEvent.click(addButton);
    await userEvent.type(input, "Todo 2");
    await userEvent.click(addButton);

    let counter = await screen.findByTestId("items-left");
    expect((counter as Gtk.Label).getLabel()).toContain("2");

    const checkboxes = await screen.findAllByRole(Gtk.AccessibleRole.CHECKBOX);
    await userEvent.click(checkboxes[0] as Gtk.Widget);

    counter = await screen.findByTestId("items-left");
    expect((counter as Gtk.Label).getLabel()).toContain("1");
  });
});
```

