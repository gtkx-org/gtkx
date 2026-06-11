# Testing

GTKX provides testing utilities through `@gtkx/testing`, offering an API similar to React Testing Library.

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

## Basic test

```tsx
import * as Gtk from "@gtkx/gi/gtk";
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

## Testing hooks

Use `renderHook` to test custom React hooks in isolation:

```tsx
import { cleanup, renderHook } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { useCounter } from "../src/hooks/useCounter.js";

describe("useCounter", () => {
    afterEach(async () => {
        await cleanup();
    });

    it("increments the counter", async () => {
        const { result, rerender } = await renderHook(() => useCounter(0));

        expect(result.current.count).toBe(0);

        result.current.increment();
        await rerender();

        expect(result.current.count).toBe(1);
    });

    it("accepts initial value", async () => {
        const { result } = await renderHook(() => useCounter(10));
        expect(result.current.count).toBe(10);
    });
});
```

See the [renderHook API reference](/api/testing/functions/renderHook.md) for full details.

## Querying by widget state

Role queries can filter by widget state like `pressed`, `expanded`, and `selected`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkExpander, GtkToggleButton } from "@gtkx/jsx/gtk";
import { cleanup, render, screen } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";

describe("role state queries", () => {
    afterEach(async () => {
        await cleanup();
    });

    it("finds pressed toggle buttons", async () => {
        await render(<GtkToggleButton label="Bold" active />, { wrapper: false });

        const pressed = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            pressed: true,
        });
        expect(pressed).toBeDefined();
    });

    it("finds expanded expanders", async () => {
        await render(<GtkExpander label="Details" expanded />, { wrapper: false });

        const expanded = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            expanded: true,
        });
        expect(expanded).toBeDefined();
    });
});
```

## Waiting for async conditions

Use `waitFor` to poll until an assertion passes, useful for testing async data loading or delayed UI updates:

```tsx
import { GtkLabel } from "@gtkx/jsx/gtk";
import { cleanup, render, screen, waitFor } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { useEffect, useState } from "react";

const AsyncComponent = () => {
    const [loaded, setLoaded] = useState(false);
    useEffect(() => { setTimeout(() => setLoaded(true), 100); }, []);
    return <GtkLabel label={loaded ? "Loaded" : "Loading..."} />;
};

describe("async", () => {
    afterEach(async () => {
        await cleanup();
    });

    it("waits for data to load", async () => {
        await render(<AsyncComponent />, { wrapper: false });

        await waitFor(async () => {
            const label = await screen.findByText("Loaded");
            expect(label).toBeDefined();
        });
    });
});
```

## Complete example

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { cleanup, render, screen, userEvent, within } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { TodoApp } from "../src/app.js";

describe("TodoApp", () => {
    afterEach(async () => {
        await cleanup();
    });

    it("adds a new todo", async () => {
        await render(<TodoApp />, { wrapper: false });

        const input = await screen.findByName("todo-input");
        const addButton = await screen.findByName("add-button");

        await userEvent.type(input, "Buy groceries");
        await userEvent.click(addButton);

        const todoText = await screen.findByText("Buy groceries");
        expect(todoText).toBeDefined();
    });

    it("toggles todo completion", async () => {
        await render(<TodoApp />, { wrapper: false });

        const input = await screen.findByName("todo-input");
        await userEvent.type(input, "Test todo");
        await userEvent.click(await screen.findByName("add-button"));

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

        const input = await screen.findByName("todo-input");
        await userEvent.type(input, "Todo to delete");
        await userEvent.click(await screen.findByName("add-button"));

        const deleteButton = await screen.findByName(/^delete-/);
        await userEvent.click(deleteButton);

        const emptyMessage = await screen.findByText("No tasks yet");
        expect(emptyMessage).toBeDefined();
    });

    it("updates the remaining count", async () => {
        await render(<TodoApp />, { wrapper: false });

        const input = await screen.findByName("todo-input");
        const addButton = await screen.findByName("add-button");

        await userEvent.type(input, "Todo 1");
        await userEvent.click(addButton);
        await userEvent.type(input, "Todo 2");
        await userEvent.click(addButton);

        let counter = await screen.findByName("items-left");
        expect((counter as Gtk.Label).getLabel()).toContain("2");

        const checkboxes = await screen.findAllByRole(Gtk.AccessibleRole.CHECKBOX);
        await userEvent.click(checkboxes[0] as Gtk.Widget);

        counter = await screen.findByName("items-left");
        expect((counter as Gtk.Label).getLabel()).toContain("1");
    });
});
```
