---
sidebar_position: 12
---

# Testing

The `@gtkx/testing` package provides Testing Library-style utilities for testing GTK components.

## Setup

Install the testing package:

```bash
pnpm add -D @gtkx/testing
```

### Display Requirements

GTK tests require a display. Use `xvfb-run` for headless testing:

```bash
GDK_BACKEND=x11 \
GSK_RENDERER=cairo \
LIBGL_ALWAYS_SOFTWARE=1 \
xvfb-run -a vitest
```

The generated test script includes these variables automatically.

## Basic Test

```tsx
import { render, screen, cleanup } from '@gtkx/testing';
import { GtkButton, GtkLabel, GtkBox } from '@gtkx/react';
import * as Gtk from '@gtkx/ffi/gtk';
import { afterEach, test, expect } from 'vitest';

afterEach(async () => {
    await cleanup();
});

test('renders a button', async () => {
    await render(<GtkButton label="Click me" />);

    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
    expect(button).toBeDefined();
});
```

Key points:
- `render()` is async and wraps content in `GtkApplicationWindow` by default
- `cleanup()` must be called after each test
- All queries are async and wait for elements to appear

## Queries

### findByRole

Find elements by accessible role:

```tsx
import * as Gtk from '@gtkx/ffi/gtk';

const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
const textbox = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
const checkbox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX);
```

With options:

```tsx
const submitButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
    name: 'Submit'
});

const checkedBox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
    checked: true
});

const expandedRow = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
    expanded: true
});
```

### findByText

Find elements by text content:

```tsx
const label = await screen.findByText('Hello, World!');
const partialMatch = await screen.findByText(/hello/i);
```

### findByLabelText

Find form controls by associated label:

```tsx
const emailInput = await screen.findByLabelText('Email Address');
```

### findByTestId

Find by widget name (set via `name` prop):

```tsx
<GtkButton name="submit-btn" label="Submit" />

const button = await screen.findByTestId('submit-btn');
```

### findAll Variants

Find multiple matching elements:

```tsx
const allButtons = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON);
const allLabels = await screen.findAllByText(/item/i);
```

## Role Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string \| RegExp` | Accessible name |
| `checked` | `boolean` | Checkbox/switch state |
| `pressed` | `boolean` | Toggle button state |
| `selected` | `boolean` | Selection state |
| `expanded` | `boolean` | Expander state |
| `level` | `number` | Heading level (1-6) |

## User Events

### Clicking

```tsx
import { userEvent } from '@gtkx/testing';

const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
await userEvent.click(button);
await userEvent.dblClick(button);
await userEvent.tripleClick(button);
```

### Typing

```tsx
const input = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
await userEvent.type(input, 'Hello, World!');
await userEvent.clear(input);
```

### Activation

```tsx
await userEvent.activate(entry);
```

### Tab Navigation

```tsx
await userEvent.tab(element);
await userEvent.tab(element, { shift: true });
```

### Selection

```tsx
await userEvent.selectOptions(dropdown, [0]);
await userEvent.selectOptions(listbox, [0, 2, 3]);
```

## Fire Event

Emit GTK signals directly:

```tsx
import { fireEvent } from '@gtkx/testing';

await fireEvent(button, 'clicked');
await fireEvent(entry, 'activate');
await fireEvent(toggle, 'toggled');
```

With arguments:

```tsx
await fireEvent(widget, 'custom-signal', {
    type: { type: 'int', size: 32 },
    value: 42
});
```

## Waiting

### waitFor

Wait for a condition:

```tsx
import { waitFor } from '@gtkx/testing';

await userEvent.click(submitButton);

await waitFor(async () => {
    const message = await screen.findByText('Success!');
    expect(message).toBeDefined();
});
```

With options:

```tsx
await waitFor(callback, {
    timeout: 2000,
    interval: 100
});
```

### waitForElementToBeRemoved

Wait for an element to disappear:

```tsx
import { waitForElementToBeRemoved } from '@gtkx/testing';

const loader = await screen.findByText('Loading...');
await waitForElementToBeRemoved(loader);
```

## Scoped Queries

Use `within` to scope queries to a container:

```tsx
import { within } from '@gtkx/testing';

const dialog = await screen.findByRole(Gtk.AccessibleRole.DIALOG);
const { findByRole, findByText } = within(dialog);

const confirmButton = await findByRole(Gtk.AccessibleRole.BUTTON, {
    name: 'Confirm'
});
```

## Render Options

### Default Wrapper

By default, `render` wraps content in `GtkApplicationWindow`:

```tsx
await render(<GtkButton label="Click" />);

await render(
    <GtkApplicationWindow>
        <GtkButton label="Click" />
    </GtkApplicationWindow>
);
```

### Custom Wrapper

```tsx
const Wrapper = ({ children }) => (
    <GtkApplicationWindow>
        <ThemeProvider theme="dark">
            {children}
        </ThemeProvider>
    </GtkApplicationWindow>
);

await render(<MyComponent />, { wrapper: Wrapper });
```

### No Wrapper

For testing multiple windows:

```tsx
await render(
    <>
        <GtkApplicationWindow title="Window 1" />
        <GtkApplicationWindow title="Window 2" />
    </>,
    { wrapper: false }
);
```

## Render Result

```tsx
const { container, rerender, unmount, debug } = await render(<MyComponent />);

await rerender(<MyComponent newProp="value" />);

debug();

await unmount();
```

| Property | Description |
|----------|-------------|
| `container` | GTK Application instance |
| `rerender(element)` | Re-render with new element |
| `unmount()` | Unmount the component |
| `debug()` | Print widget tree to console |
| `findBy*` | Query methods bound to container |

## Example: Counter Test

```tsx
import * as Gtk from '@gtkx/ffi/gtk';
import { render, screen, userEvent, cleanup } from '@gtkx/testing';
import { afterEach, test, expect } from 'vitest';
import Counter from '../src/counter.js';

afterEach(async () => {
    await cleanup();
});

test('increments count', async () => {
    await render(<Counter />);

    await screen.findByText('Count: 0');

    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
        name: 'Increment'
    });
    await userEvent.click(button);

    await screen.findByText('Count: 1');
});

test('handles multiple clicks', async () => {
    await render(<Counter />);

    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
        name: 'Increment'
    });

    await userEvent.click(button);
    await userEvent.click(button);
    await userEvent.click(button);

    await screen.findByText('Count: 3');
});
```

## API Reference

### Lifecycle

| Function | Description |
|----------|-------------|
| `render(element, options?)` | Render component for testing |
| `cleanup()` | Unmount rendered components |
| `teardown()` | Full GTK cleanup (global teardown) |

### Queries

| Query | Description |
|-------|-------------|
| `findByRole(role, options?)` | Find by accessible role |
| `findByText(text, options?)` | Find by text content |
| `findByLabelText(text, options?)` | Find by label |
| `findByTestId(id)` | Find by widget name |
| `findAllBy*` | Find multiple elements |

### User Events

| Function | Description |
|----------|-------------|
| `userEvent.click(element)` | Click |
| `userEvent.dblClick(element)` | Double click |
| `userEvent.tripleClick(element)` | Triple click |
| `userEvent.activate(element)` | Activate (Enter) |
| `userEvent.type(element, text)` | Type text |
| `userEvent.clear(element)` | Clear input |
| `userEvent.tab(element, options?)` | Tab navigation |
| `userEvent.selectOptions(element, values)` | Select options |

### Utilities

| Function | Description |
|----------|-------------|
| `waitFor(callback, options?)` | Wait for condition |
| `waitForElementToBeRemoved(element)` | Wait for removal |
| `within(container)` | Scope queries to container |
| `fireEvent(element, signal, ...args)` | Emit GTK signal |

## Tips

1. Always call `cleanup()` in `afterEach`
2. Use `findByRole` with `name` option for robust tests
3. All queries are async - use `await`
4. Use `debug()` to inspect widget tree when tests fail
5. Prefer `userEvent` over `fireEvent` for user interactions
6. Test behavior, not implementation details
