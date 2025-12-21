---
sidebar_position: 8
sidebar_label: Testing
---

# Testing

GTKX provides `@gtkx/testing`, a Testing Library-inspired package for testing GTK components. It offers familiar APIs like `screen`, `userEvent`, and query functions.

## Installation

```bash
npm install -D @gtkx/testing
```

## Setup

`@gtkx/testing` works with any test runner (Jest, Vitest, Node's built-in test runner, etc.).

### Display Requirements

Tests require a display. Use `xvfb-run` to run tests in a virtual framebuffer:

```bash
GDK_BACKEND=x11 GSK_RENDERER=cairo LIBGL_ALWAYS_SOFTWARE=1 xvfb-run -a <your-test-command>
```

The environment variables configure GTK for headless testing:
- `GDK_BACKEND=x11` — Forces the X11 backend (required for xvfb)
- `GSK_RENDERER=cairo` — Uses the Cairo software renderer
- `LIBGL_ALWAYS_SOFTWARE=1` — Forces software rendering, avoiding EGL/DRI3 warnings

## Writing Tests

### Basic Test Structure

```tsx
import { cleanup, render, screen } from "@gtkx/testing";
import { App } from "../src/app.js";

// Clean up after each test
afterEach(async () => {
  await cleanup();
});

test("renders the title", async () => {
  await render(<App />);

  const title = await screen.findByText("Welcome");
  expect(title).toBeDefined();
});
```

GTK is automatically initialized on the first `render()` call—no manual setup required.

### Query Functions

GTKX testing provides async query functions to find elements:

| Variant      | Returns           | Throws if not found? |
| ------------ | ----------------- | -------------------- |
| `findBy*`    | Single element    | Yes                  |
| `findAllBy*` | Array of elements | Yes (if empty)       |

All queries are async and will wait for elements to appear (with a default timeout of 1000ms).

#### By Text

```tsx
// Find by exact text
const label = await screen.findByText("Hello, World!");

// Find by partial text (regex)
const greeting = await screen.findByText(/hello/i);

// Find all matching elements
const allLabels = await screen.findAllByText(/item/i);
```

#### By Role

GTK widgets have accessibility roles. Use `findByRole` to query by role:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
  name: "Submit",
});

const anyButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON);

const checked = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
  checked: true,
});

const expanded = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
  expanded: true,
});
```

Import `Gtk` from `@gtkx/ffi/gtk` to access all available roles via `Gtk.AccessibleRole`.

#### By Label Text

Find form controls by their associated label:

```tsx
const input = await screen.findByLabelText("Email Address");
```

#### By Test ID

Find elements by their widget name (test ID). Set the `name` prop on a widget to use this query:

```tsx
// In your component
<GtkButton name="submit-btn">Submit</GtkButton>;

// In your test
const button = await screen.findByTestId("submit-btn");
```

## User Interactions

Use `userEvent` to simulate user actions:

### Clicking

```tsx
import { userEvent } from "@gtkx/testing";

const button = await screen.findByRole(AccessibleRole.BUTTON, {
  name: "Increment",
});
await userEvent.click(button);

// Double-click
await userEvent.dblClick(button);
```

### Typing

```tsx
const input = await screen.findByRole(AccessibleRole.TEXT_BOX);
await userEvent.type(input, "Hello, World!");

// Clear input field
await userEvent.clear(input);
```

## Low-Level Events

For more control, use `fireEvent` to emit GTK signals directly:

```tsx
import { fireEvent } from "@gtkx/testing";

// Fire any signal by name
await fireEvent(button, "clicked");
await fireEvent(entry, "activate");
await fireEvent(checkbox, "toggled");

// Pass additional arguments to signal handlers
await fireEvent(widget, "custom-signal", {
  type: { type: "int", size: 32 },
  value: 42,
});
```

For common user interactions like clicking or typing, prefer `userEvent` instead.

## Waiting for Changes

### `waitFor`

Wait for a condition to be true:

```tsx
import { waitFor } from "@gtkx/testing";

await userEvent.click(submitButton);

await waitFor(async () => {
  const message = await screen.findByText("Success!");
  expect(message).toBeDefined();
});

// With custom options
await waitFor(
  async () => {
    const done = await screen.findByText("Done");
    expect(done).toBeDefined();
  },
  { timeout: 2000, interval: 100 }
);
```

### `waitForElementToBeRemoved`

Wait for an element to be removed from the widget tree:

```tsx
import { waitForElementToBeRemoved } from "@gtkx/testing";

const loader = await screen.findByText("Loading...");
await waitForElementToBeRemoved(loader);
```

### `findBy*` Queries

`findBy*` queries automatically wait for elements:

```tsx
// Waits up to 1000ms for the element to appear
const message = await screen.findByText("Loading complete");
```

## Scoped Queries with `within`

Use `within` to scope queries to a specific container element. This is useful when you have multiple similar elements and need to query within a specific section:

```tsx
import { within } from "@gtkx/testing";

// Find a dialog and query within it
const dialog = await screen.findByRole(AccessibleRole.DIALOG);
const { findByRole, findByText } = within(dialog);

// These queries only search within the dialog
const confirmButton = await findByRole(AccessibleRole.BUTTON, {
  name: "Confirm",
});
const message = await findByText("Are you sure?");
```

### Nested Containers

You can chain `within` calls to query deeply nested elements:

```tsx
const sidebar = await screen.findByTestId("sidebar");
const { findByTestId } = within(sidebar);

const userSection = await findByTestId("user-section");
const { findByText } = within(userSection);

const username = await findByText("John Doe");
```

### Comparing Scoped vs Global Queries

```tsx
// Render a UI with multiple sections
await render(
  <GtkBox orientation={Orientation.VERTICAL} spacing={8}>
    <GtkBox orientation={Orientation.VERTICAL} spacing={0} name="section-a">
      <GtkButton label="Save" />
    </GtkBox>
    <GtkBox orientation={Orientation.VERTICAL} spacing={0} name="section-b">
      <GtkButton label="Save" />
    </GtkBox>
  </GtkBox>
);

// Global query finds all matching elements
const allSaveButtons = await screen.findAllByText("Save");
// Returns 2 buttons

// Scoped query finds only elements within the container
const sectionA = await screen.findByTestId("section-a");
const { findAllByText } = within(sectionA);
const sectionASaveButtons = await findAllByText("Save");
// Returns 1 button
```

## Complete Example

Here's a full test for a counter component:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { cleanup, render, screen, userEvent } from "@gtkx/testing";
import { Counter } from "../src/counter.js";

afterEach(async () => {
  await cleanup();
});

test("renders initial count of zero", async () => {
  await render(<Counter />);

  const label = await screen.findByText("Count: 0");
  expect(label).toBeDefined();
});

test("increments count when clicking increment button", async () => {
  await render(<Counter />);

  const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
    name: "Increment",
  });
  await userEvent.click(button);

  await screen.findByText("Count: 1");
});

test("decrements count when clicking decrement button", async () => {
  await render(<Counter />);

  const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
    name: "Decrement",
  });
  await userEvent.click(button);

  await screen.findByText("Count: -1");
});

test("resets count when clicking reset button", async () => {
  await render(<Counter />);

  const increment = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
    name: "Increment",
  });
  await userEvent.click(increment);
  await userEvent.click(increment);
  await userEvent.click(increment);
  await screen.findByText("Count: 3");

  const reset = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
    name: "Reset",
  });
  await userEvent.click(reset);

  await screen.findByText("Count: 0");
});
```

## Render Options

The `render` function is async and accepts an options object.

### Default GtkApplicationWindow Wrapper

By default, `render` wraps your component in a `GtkApplicationWindow`. This means you don't need to manually wrap your test content:

```tsx
import { render } from "@gtkx/testing";

// This works out of the box - no GtkApplicationWindow needed
await render(<GtkButton label="Click me" />);

// Equivalent to:
await render(
  <GtkApplicationWindow>
    <GtkButton label="Click me" />
  </GtkApplicationWindow>
);
```

### Custom Wrapper

You can provide a custom wrapper component, which replaces the default `GtkApplicationWindow` wrapper:

```tsx
import { render } from "@gtkx/testing";

// With a wrapper component (useful for providers)
const Wrapper = ({ children }) => (
  <GtkApplicationWindow>
    <ThemeProvider theme="dark">{children}</ThemeProvider>
  </GtkApplicationWindow>
);

const { container, rerender, unmount, debug } = await render(<MyComponent />, {
  wrapper: Wrapper,
});

// Rerender with new props
await rerender(<MyComponent newProp="value" />);

// Debug the widget tree
debug();

// Unmount the component
await unmount();
```

### Disabling the Default Wrapper

For advanced cases like testing multiple windows, disable the default wrapper by setting `wrapper: false`:

```tsx
import { render } from "@gtkx/testing";

// Render multiple windows without the default wrapper
await render(
  <>
    <GtkApplicationWindow>
      <GtkButton label="Window 1" />
    </GtkApplicationWindow>
    <GtkApplicationWindow>
      <GtkButton label="Window 2" />
    </GtkApplicationWindow>
  </>,
  { wrapper: false }
);
```

## API Reference

### Lifecycle Functions

| Function                    | Description                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `render(element, options?)` | Render a React element for testing. Wraps in `GtkApplicationWindow` by default. Returns `Promise<RenderResult>`. |
| `cleanup()`                 | Unmount rendered components. Returns `Promise<void>`. Call after each test.                                   |
| `teardown()`                | Clean up GTK entirely. Returns `Promise<void>`. Used in global teardown.                                      |

### RenderResult

The object returned by `render()`:

| Property/Method         | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `container`             | The GTK Application instance                             |
| `rerender(element)`     | Re-render with a new element. Returns `Promise<void>`.   |
| `unmount()`             | Unmount the rendered component. Returns `Promise<void>`. |
| `debug()`               | Print the widget tree to console                         |
| `findBy*`, `findAllBy*` | Query methods bound to the container                     |

### Screen Queries

All queries are available on the `screen` object and on `RenderResult`:

| Query Type     | Variants      | Description             |
| -------------- | ------------- | ----------------------- |
| `*ByRole`      | find, findAll | Find by accessible role |
| `*ByText`      | find, findAll | Find by text content    |
| `*ByLabelText` | find, findAll | Find by label text      |
| `*ByTestId`    | find, findAll | Find by widget name     |

### Query Options

#### TextMatchOptions

```tsx
await screen.findByText("hello", {
  exact: false, // Enable substring matching (default: true)
  normalizer: (text) => text.toLowerCase(), // Custom text normalizer
});
```

#### ByRoleOptions

```tsx
await screen.findByRole(AccessibleRole.BUTTON, {
  name: "Submit", // Match by accessible name
  checked: true, // For checkboxes/radios
  expanded: true, // For expanders
  pressed: true, // For toggle buttons
  selected: true, // For selectable items
  level: 2, // For headings
});
```

### User Events

| Function                                     | Description                                      |
| -------------------------------------------- | ------------------------------------------------ |
| `userEvent.click(element)`                   | Click an element                                 |
| `userEvent.dblClick(element)`                | Double-click an element                          |
| `userEvent.tripleClick(element)`             | Triple-click an element                          |
| `userEvent.activate(element)`                | Activate an element (e.g., press Enter in input) |
| `userEvent.type(element, text)`              | Type text into an input                          |
| `userEvent.clear(element)`                   | Clear an input field                             |
| `userEvent.tab(element, options?)`           | Simulate Tab navigation                          |
| `userEvent.selectOptions(element, values)`   | Select options in ComboBox/ListBox               |
| `userEvent.deselectOptions(element, values)` | Deselect options in ListBox                      |

### Fire Event

| Function                                  | Description                                 |
| ----------------------------------------- | ------------------------------------------- |
| `fireEvent(element, signalName, ...args)` | Fire any GTK signal with optional arguments |

### Scoped Queries

| Function            | Description                                           |
| ------------------- | ----------------------------------------------------- |
| `within(container)` | Returns query functions scoped to a container element |

### Async Utilities

| Function                                       | Description                     |
| ---------------------------------------------- | ------------------------------- |
| `waitFor(callback, options?)`                  | Wait for a condition to be true |
| `waitForElementToBeRemoved(element, options?)` | Wait for element removal        |

#### WaitForOptions

```tsx
await waitFor(callback, {
  timeout: 1000, // Max wait time in ms (default: 1000)
  interval: 50, // Poll interval in ms (default: 50)
  onTimeout: (error) => new Error("Custom message"), // Custom timeout error
});
```

## Tips

1. **Always call `await cleanup()`** in `afterEach` to prevent test pollution
2. **Use `await render()`** — render is async
3. **Use `findBy*` queries** — all queries are async and will wait for elements
4. **Use roles over text** when possible for more robust tests
5. **Test behavior, not implementation** — focus on what users see and do
6. **Use `debug()`** to inspect the widget tree when tests fail
