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

        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "My App" });
        expect(window).toBeDefined();
    });
});
```

## API Reference

### `render`

Renders a React component in a GTK application context.

```tsx
const result = await render(<MyComponent />, options);
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `wrapper` | `boolean \| ComponentType` | `true` | Wrap in `GtkApplicationWindow` |

**Returns:**

```tsx
{
    container: Gtk.Application,
    unmount: () => Promise<void>,
    rerender: (element: ReactNode) => Promise<void>,
    debug: () => void,
    // ...bound query functions
}
```

### `screen`

Global query functions that search the entire rendered tree.

```tsx
// Find single elements
await screen.findByRole(role, options)
await screen.findByText(text, options)
await screen.findByLabelText(text, options)
await screen.findByTestId(testId, options)

// Find multiple elements
await screen.findAllByRole(role, options)
await screen.findAllByText(text, options)
await screen.findAllByLabelText(text, options)
await screen.findAllByTestId(testId, options)
```

### Query by Role

Find widgets by their accessible role:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

// Find a button
const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Submit" });

// Find a checkbox
const checkbox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: true });

// Find a text field
const input = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);

// Find a window
const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "My App" });
```

Common roles:
- `Gtk.AccessibleRole.BUTTON`
- `Gtk.AccessibleRole.CHECKBOX`
- `Gtk.AccessibleRole.TEXT_BOX`
- `Gtk.AccessibleRole.LABEL`
- `Gtk.AccessibleRole.WINDOW`
- `Gtk.AccessibleRole.LIST`
- `Gtk.AccessibleRole.LIST_ITEM`

### Query by Text

Find widgets containing specific text:

```tsx
// Exact match (default)
const label = await screen.findByText("Hello World");

// Regex pattern
const label = await screen.findByText(/hello/i);

// Custom matcher
const label = await screen.findByText((text, widget) => {
    return text.includes("Hello") && widget instanceof Gtk.Label;
});
```

### Query by Test ID

Find widgets by their `name` property:

```tsx
// In component
<GtkButton name="submit-button" label="Submit" />

// In test
const button = await screen.findByTestId("submit-button");
```

### `userEvent`

Simulate user interactions:

```tsx
import { userEvent } from "@gtkx/testing";

// Click
await userEvent.click(button);

// Double click
await userEvent.dblClick(element);

// Type text
await userEvent.type(input, "Hello World");

// Clear input
await userEvent.clear(input);

// Toggle checkbox/switch
await userEvent.click(checkbox);

// Select dropdown option
await userEvent.selectOptions(dropdown, 0);

// Tab navigation
await userEvent.tab(element);
await userEvent.tab(element, { shift: true });  // Shift+Tab
```

### `waitFor`

Wait for a condition to be true:

```tsx
import { waitFor } from "@gtkx/testing";

await waitFor(() => {
    const label = screen.findByTestId("counter");
    expect((label as Gtk.Label).getLabel()).toBe("5");
}, { timeout: 2000 });
```

### `waitForElementToBeRemoved`

Wait for an element to disappear:

```tsx
import { waitForElementToBeRemoved } from "@gtkx/testing";

const loading = await screen.findByText("Loading...");
await waitForElementToBeRemoved(loading);
```

### `within`

Scope queries to a subtree:

```tsx
import { within } from "@gtkx/testing";

const listItem = await screen.findByTestId("todo-1");
const { findByRole } = within(listItem);

const checkbox = await findByRole(Gtk.AccessibleRole.CHECKBOX);
const deleteButton = await findByRole(Gtk.AccessibleRole.BUTTON);
```

### `cleanup`

Unmount rendered components and reset state:

```tsx
afterEach(async () => {
    await cleanup();
});
```

## Debugging

### `screen.debug`

Print the widget tree to the console for debugging:

```tsx
await render(<MyComponent />);
screen.debug();
```

This outputs an HTML-like representation of the widget hierarchy with accessible roles and properties:

```
<GtkApplicationWindow role="window">
  <GtkBox role="group">
    <GtkButton data-testid="submit" role="button">
      Submit
    </GtkButton>
  </GtkBox>
</GtkApplicationWindow>
```

### `prettyWidget`

Generate a formatted string representation of a widget tree:

```tsx
import { prettyWidget } from "@gtkx/testing";

const output = prettyWidget(container, {
    maxLength: 5000,  // Truncate output (default: 7000)
    highlight: true,  // Enable ANSI colors (auto-detected by default)
});
```

### `logWidget`

Log a widget tree directly to the console:

```tsx
import { logWidget } from "@gtkx/testing";

logWidget(window);
```

## Screenshots

### `screen.screenshot`

Capture a screenshot of an application window:

```tsx
await render(<MyApp />);

// Capture first window
const result = await screen.screenshot();

// Capture window by index
await screen.screenshot(0);

// Capture window by title substring
await screen.screenshot("Settings");

// Capture window by title regex
await screen.screenshot(/^My App/);

// With custom timeout options
await screen.screenshot("Settings", { timeout: 200, interval: 20 });
```

The screenshot is automatically saved to a temporary file and the path is logged.

**Returns:**

```typescript
{
    data: string;     // Base64-encoded PNG
    mimeType: string; // "image/png"
    width: number;    // Image width in pixels
    height: number;   // Image height in pixels
}
```

### `screenshot`

Capture a screenshot of any widget directly:

```tsx
import { screenshot } from "@gtkx/testing";

const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
const result = await screenshot(button, {
    timeout: 200,   // Max wait time (default: 100ms)
    interval: 20,   // Retry interval (default: 10ms)
});
```

## Complete Example

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { cleanup, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { TodoApp } from "../src/app.js";

describe("TodoApp", () => {
    afterEach(async () => {
        await cleanup();
    });

    it("adds a new todo", async () => {
        await render(<TodoApp />, { wrapper: false });

        // Find input and add button
        const input = await screen.findByTestId("todo-input");
        const addButton = await screen.findByTestId("add-button");

        // Type and submit
        await userEvent.type(input, "Buy groceries");
        await userEvent.click(addButton);

        // Verify todo was added
        const todoText = await screen.findByText("Buy groceries");
        expect(todoText).toBeDefined();
    });

    it("toggles todo completion", async () => {
        await render(<TodoApp />, { wrapper: false });

        // Add a todo
        const input = await screen.findByTestId("todo-input");
        await userEvent.type(input, "Test todo");
        await userEvent.click(await screen.findByTestId("add-button"));

        // Find and toggle checkbox
        const checkbox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: false });
        await userEvent.click(checkbox);

        // Verify it's checked
        const checkedBox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: true });
        expect(checkedBox).toBeDefined();
    });

    it("deletes a todo", async () => {
        await render(<TodoApp />, { wrapper: false });

        // Add a todo
        const input = await screen.findByTestId("todo-input");
        await userEvent.type(input, "Todo to delete");
        await userEvent.click(await screen.findByTestId("add-button"));

        // Delete it
        const deleteButton = await screen.findByTestId(/^delete-/);
        await userEvent.click(deleteButton);

        // Verify empty state
        const emptyMessage = await screen.findByText("No tasks yet");
        expect(emptyMessage).toBeDefined();
    });

    it("updates the remaining count", async () => {
        await render(<TodoApp />, { wrapper: false });

        const input = await screen.findByTestId("todo-input");
        const addButton = await screen.findByTestId("add-button");

        // Add two todos
        await userEvent.type(input, "Todo 1");
        await userEvent.click(addButton);
        await userEvent.type(input, "Todo 2");
        await userEvent.click(addButton);

        // Check count
        let counter = await screen.findByTestId("items-left");
        expect((counter as Gtk.Label).getLabel()).toContain("2");

        // Complete one
        const checkboxes = await screen.findAllByRole(Gtk.AccessibleRole.CHECKBOX);
        await userEvent.click(checkboxes[0] as Gtk.Widget);

        // Verify count updated
        counter = await screen.findByTestId("items-left");
        expect((counter as Gtk.Label).getLabel()).toContain("1");
    });
});
```

## Tips

1. **Always cleanup** — Use `afterEach(() => cleanup())` to prevent test pollution
2. **Use `wrapper: false`** — When your component includes its own `GtkApplicationWindow`
3. **Prefer role queries** — More robust than text queries
4. **Use test IDs sparingly** — Add `name` props only when role/text queries aren't sufficient
5. **Check widget properties** — Cast to specific types to access GTK properties like `getLabel()`
