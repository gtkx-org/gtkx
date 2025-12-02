---
sidebar_position: 3
---

# Testing

GTKX provides `@gtkx/testing`, a Testing Library-inspired package for testing GTK components. It offers familiar APIs like `screen`, `userEvent`, and query functions.

## Installation

```bash
pnpm add -D @gtkx/testing vitest
```

## Setup

Create a test setup file and configure Vitest:

### `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
```

### `package.json`

Tests require `xvfb-run` because GTK needs a display:

```json
{
  "scripts": {
    "test": "xvfb-run -a vitest run"
  }
}
```

## Writing Tests

### Basic Test Structure

```tsx
import { cleanup, render, screen, setup } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/app.js";

// Initialize GTK for testing
setup();

describe("App", () => {
  // Clean up after each test
  afterEach(() => cleanup());

  it("renders the title", async () => {
    render(<App />);

    const title = await screen.findByText("Welcome");
    expect(title).toBeDefined();
  });
});
```

### Query Functions

GTKX testing provides several ways to find elements:

#### By Text

```tsx
// Find by exact text
const label = await screen.findByText("Hello, World!");

// Find by partial text (regex)
const greeting = await screen.findByText(/hello/i);
```

#### By Role

GTK widgets have accessibility roles. Use `findByRole` to query by role:

```tsx
import { AccessibleRole } from "@gtkx/ffi/gtk";

// Find a button by role and name
const button = await screen.findByRole(AccessibleRole.BUTTON, {
  name: "Submit",
});

// Find any button
const anyButton = await screen.findByRole(AccessibleRole.BUTTON);
```

Common roles:
- `AccessibleRole.BUTTON` — Buttons
- `AccessibleRole.LABEL` — Labels
- `AccessibleRole.TEXT_BOX` — Text inputs
- `AccessibleRole.CHECKBOX` — Checkboxes
- `AccessibleRole.SWITCH` — Switches

#### By Label Text

Find form controls by their associated label:

```tsx
const input = await screen.findByLabelText("Email Address");
```

### Synchronous Queries

For elements that are immediately available, use `getBy*` variants:

```tsx
// Throws if not found
const button = screen.getByText("Click me");
const input = screen.getByRole(AccessibleRole.TEXT_BOX);
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
```

### Typing

```tsx
const input = await screen.findByRole(AccessibleRole.TEXT_BOX);
await userEvent.type(input, "Hello, World!");
```

## Waiting for Changes

### `waitFor`

Wait for a condition to be true:

```tsx
import { waitFor } from "@gtkx/testing";

await userEvent.click(submitButton);

await waitFor(() => {
  expect(screen.getByText("Success!")).toBeDefined();
});
```

### `findBy*` Queries

`findBy*` queries automatically wait for elements:

```tsx
// Waits up to 1000ms for the element to appear
const message = await screen.findByText("Loading complete");
```

## Complete Example

Here's a full test for a counter component:

```tsx
import { AccessibleRole } from "@gtkx/ffi/gtk";
import { cleanup, render, screen, setup, userEvent } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { Counter } from "../src/counter.js";

setup();

describe("Counter", () => {
  afterEach(() => cleanup());

  it("renders initial count of zero", async () => {
    render(<Counter />);

    const label = await screen.findByText("Count: 0");
    expect(label).toBeDefined();
  });

  it("increments count when clicking increment button", async () => {
    render(<Counter />);

    const button = await screen.findByRole(AccessibleRole.BUTTON, {
      name: "Increment",
    });
    await userEvent.click(button);

    await screen.findByText("Count: 1");
  });

  it("decrements count when clicking decrement button", async () => {
    render(<Counter />);

    const button = await screen.findByRole(AccessibleRole.BUTTON, {
      name: "Decrement",
    });
    await userEvent.click(button);

    await screen.findByText("Count: -1");
  });

  it("resets count when clicking reset button", async () => {
    render(<Counter />);

    // Increment a few times
    const increment = await screen.findByRole(AccessibleRole.BUTTON, {
      name: "Increment",
    });
    await userEvent.click(increment);
    await userEvent.click(increment);
    await userEvent.click(increment);
    await screen.findByText("Count: 3");

    // Reset
    const reset = await screen.findByRole(AccessibleRole.BUTTON, {
      name: "Reset",
    });
    await userEvent.click(reset);

    await screen.findByText("Count: 0");
  });
});
```

## API Reference

### Setup Functions

| Function | Description |
|----------|-------------|
| `setup()` | Initialize GTK for testing. Call once before all tests. |
| `teardown()` | Clean up GTK. Called automatically in most cases. |
| `cleanup()` | Unmount rendered components. Call after each test. |

### Render

| Function | Description |
|----------|-------------|
| `render(element)` | Render a React element for testing. Returns `RenderResult`. |

### Screen Queries

| Query | Waits? | Throws if not found? |
|-------|--------|---------------------|
| `getByText` | No | Yes |
| `getByRole` | No | Yes |
| `getByLabelText` | No | Yes |
| `findByText` | Yes | Yes |
| `findByRole` | Yes | Yes |
| `findByLabelText` | Yes | Yes |

### User Events

| Function | Description |
|----------|-------------|
| `userEvent.click(element)` | Click an element |
| `userEvent.type(element, text)` | Type text into an input |

### Utilities

| Function | Description |
|----------|-------------|
| `waitFor(callback, options?)` | Wait for a condition to be true |

## Tips

1. **Always call `cleanup()`** in `afterEach` to prevent test pollution
2. **Prefer `findBy*` queries** for elements that may need time to appear
3. **Use roles over text** when possible for more robust tests
4. **Test behavior, not implementation** — focus on what users see and do
