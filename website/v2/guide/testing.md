---
title: "Testing"
description: "Testing GTKX components headlessly: the render, query, and userEvent model, with a simple example."
---

# Testing

GTKX ships a React Testing Library-inspired testing package: the same API, adapted to GTK4.

## Setup

A scaffolded project (answer yes to "Include testing setup (Vitest)?" in `npm create gtkx@beta`) already ships this config. Otherwise:

```bash
npm install -D @gtkx/testing@beta vitest
```

Point a `test` script at `vitest run` and write `vitest.config.ts`:

```ts
import gtkx from "@gtkx/cli/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        include: ["tests/**/*.test.{ts,tsx}"],
        bail: 1,
    },
});
```

Each Vitest worker runs in its own headless environment, started before any test code loads and torn down with the worker. Headless runs need the compositor binary, `dbus-daemon`, and `setpriv` on the host; plugin options are in the [@gtkx/vitest reference](/v2/reference/@gtkx/vitest/).

The development server can use the same isolated display when no graphical session is available:

```bash
gtkx dev --headless --size 1280x720
```

`--size` is optional and defaults to `1024x768`. The app remains connected to the same MCP server after the private Wayland runtime starts, so widget inspection and screenshots work in a display-less development session too.

Importing `@gtkx/testing` is the entire setup: cleanup, GTK4 loop teardown, and the `expect` matchers all come with the import. There is no setup file to write.

## Faking session services

Every worker gets a private session bus, not a bridge to the user's desktop bus. Services such as portals, keyrings, GNOME Shell, and Housekeeping are therefore absent. GTKX supplies a minimal notifications service; register a fake object for any other D-Bus dependency and point the client at the connection's unique name:

```ts
import * as Gio from "@gtkx/gi/gio";
import { fromVariant, toVariant } from "@gtkx/runtime";
import { expect, it } from "vitest";

const path = "/com/example/Echo";
const interfaceName = "com.example.Echo";
const xml = `<node><interface name="${interfaceName}">
    <method name="Echo">
        <arg type="s" direction="in"/>
        <arg type="s" direction="out"/>
    </method>
</interface></node>`;

it("calls the fake service on the private bus", async () => {
    const connection = Gio.busGetSync(Gio.BusType.SESSION, null);
    const uniqueName = connection.getUniqueName();
    const info = Gio.DBusNodeInfo.newForXml(xml).lookupInterface(interfaceName);

    if (uniqueName === null || info === null) throw new Error("D-Bus setup failed");

    const handleCall: Gio.DBusInterfaceMethodCallFunc = (
        _connection,
        _sender,
        _objectPath,
        _calledInterface,
        _methodName,
        parameters,
        invocation,
    ) => {
        const [input] = fromVariant("(s)", parameters);
        invocation.returnValue(toVariant("(s)", [`reply:${input}`]));
    };
    const registrationId = connection.registerObjectWithClosures2(path, info, handleCall, null, null);

    try {
        const proxy = await Gio.DBusProxy.new(
            connection,
            Gio.DBusProxyFlags.NONE,
            info,
            uniqueName,
            path,
            interfaceName,
            null,
        );
        const reply = await proxy.call(
            "Echo",
            toVariant("(s)", ["hello"]),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
        );

        expect(fromVariant("(s)", reply)).toEqual(["reply:hello"]);
    } finally {
        connection.unregisterObject(registrationId);
    }
});
```

Using the unique name needs no well-known-name acquisition and keeps parallel workers isolated. Make the destination name injectable in the production D-Bus client, then substitute `connection.getUniqueName()` in the test. Register in the test that needs the service and always unregister in `finally` or teardown.

## Rendering and cleanup

`render` is async and must be awaited:

```tsx
import { render, screen } from "@gtkx/testing";

const { unmount, rerender, debug } = await render(<MyPanel />);
```

With no options, `render` presents the element in a harness window. `<AdwApplication>` is not a widget and cannot live there, so render an app component into `rootElement` from `@gtkx/react`:

```tsx
import { rootElement } from "@gtkx/react";

await render(<App />, { container: rootElement });
```

`rootElement` does not create a harness or parent loose widgets. Use it only when the rendered tree creates a top-level window, normally through an application component. Omit `container` for ordinary widgets and fragments; a fragment of bare widgets rendered into `rootElement` has no root widget and `render` throws.

Queries search every open toplevel, so dialogs and popovers are findable, and animations are disabled unless `areAnimationsEnabled: true` is passed. `wrapper` mounts a context provider around the element; the remaining options are in the [`render` reference](/v2/reference/@gtkx/testing/).

`screen` proxies to the most recent render and is the idiomatic way to query; `within(container)` scopes queries to a subtree, and `renderHook(callback)` tests a hook in isolation. Cleanup is automatic: every test starts from an empty display.

## Queries

Every query kind is available as `getBy`, `getAllBy`, `queryBy`, `queryAllBy`, `findBy`, and `findAllBy`:

| Kind | Matches |
|---|---|
| `ByRole` | A `Gtk.AccessibleRole`, optionally narrowed by name and accessible state |
| `ByLabelText` | A widget labeled by a `Gtk.Label` mnemonic, an `accessibleLabel`, or `accessibleLabelledBy` |
| `ByText` | The label text of LABEL-role widgets |
| `ByName` | The widget's `name` property (the `name` prop) |
| `ByPlaceholderText` | The placeholder of an editable widget |
| `ByDisplayValue` | The current text of an editable widget or `GtkTextView` |

`getBy*` throws when nothing, or more than one thing, matches; `queryBy*` returns `null` when nothing matches; and `findBy*` polls until a match appears (1000 ms by default), which makes it the right choice after any interaction that triggers a re-render.

Roles are always `Gtk.AccessibleRole` enum values, never strings: a `GtkCheckButton` reports `CHECKBOX`, an `AdwActionRow` reports `LIST_ITEM`. `ByRole` narrows further by `name` and by accessible state; see [`ByRoleOptions`](/v2/reference/@gtkx/testing/type-aliases/ByRoleOptions). Text matchers take a `string` or number, a `RegExp`, or a predicate function.

```ts
import * as Gtk from "@gtkx/gi/gtk";

const save = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" });
const entry = screen.getByPlaceholderText("Search tasks");
```

## Simulating input with userEvent

Every `userEvent` helper is async and runs inside React's `act`, so state updates flush before it resolves. Each waits up to 500 ms (`actionabilityTimeout`) for the widget to become actionable, and throws an error naming the condition that failed when it never does.

```ts
await userEvent.click(button);
await userEvent.type(entry, "hello");
await userEvent.keyboard(entry, "{Control>}a{/Control}");
```

`userEvent.click` on a list row changes the selection, on a `Gtk.TreeExpander` toggles expansion, and on a sortable column header sorts the view. Off-screen, `pointer` synthesizes left-button input only and `drag` refuses a `Gtk.Range`, so use `slide(range, value)` to move a slider. The full set of helpers is in the [`userEvent` reference](/v2/reference/@gtkx/testing/).

## fireEvent, act, and waitFor

`fireEvent(object, signalName, ...args)` emits any GObject signal directly, with no actionability checks, and must be awaited. Reach for it when the test is about a signal handler rather than a user interaction:

```ts
await fireEvent(row, "activated");
```

`act(callback)` is needed only for state mutated outside a `userEvent` or `fireEvent` call. `waitFor(callback, options?)` retries an assertion until it passes, and `waitForElementToBeRemoved` resolves once a widget leaves the tree; both default to 1000 ms, which `configure` changes globally.

## Matchers

Assertions read at the same level as queries:

```ts
expect(label).toHaveTextContent(/world/);
expect(button).toHaveAccessibleName("Save");
expect(check).toBeChecked();
```

The boolean state matchers throw when the widget does not expose that state. Accessible state and properties are asserted through `toHaveAccessibleState` and `toHaveAccessibleProperty`, not widget properties:

```ts
expect(expander).toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, true);
expect(grid).toHaveAccessibleProperty(Gtk.AccessibleProperty.SORT, Gtk.AccessibleSort.DESCENDING);
```

`toAppearBefore` and `toAppearAfter` compare two widgets by tree position, and `toContainAnyBy*` and `toContainOneBy*` run a query against a widget's own subtree.

## Debugging

`screen.debug()` prints the widget tree the way the queries see it, with roles, names, and accessibility attributes. `screen.logRoles()` groups every widget by role, the fastest way to answer which role a widget reports. `screenshot(widget)` returns the base64 PNG data, and `{ path }` also writes the image to a file; `screen.screenshot()` takes the same options and captures the active toplevel window instead of one render's subtree. For a live dev session rather than a test, the [MCP server](/v2/guide/mcp) exposes the same dumps, queries, and screenshots.

::: tip
Tests written this way double as a basic accessibility audit: a widget `getByRole` cannot find by name is usually one that is missing an accessible label.
:::

A `CRITICAL` emitted during a generated binding call throws an ordinary error from that call, or rejects its generated promise, so an intentional error-path test can catch it. A critical emitted with no active call and a panic inside the GTKX addon arrive as uncaught exceptions and fail the running test; a GLib `ERROR` aborts the worker regardless. Levels below `CRITICAL` stay as stderr lines and fail nothing. [Error Handling](/v2/guide/error-handling#failures-nothing-can-throw) separates the catchable and uncaught paths.

## A simple example

A minimal counter component, tested end to end. The test renders it, finds the button by role, clicks it twice, and asserts on the resulting label text:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { useState } from "react";
import { describe, expect, it } from "vitest";

function Counter() {
    const [count, setCount] = useState(0);
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>{`Count: ${count}`}</GtkLabel>
            <GtkButton label="Increment" onClicked={() => setCount((c) => c + 1)} />
        </GtkBox>
    );
}

describe("Counter", () => {
    it("increments when the button is clicked", async () => {
        await render(<Counter />);

        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" });
        await userEvent.click(button);
        await userEvent.click(button);

        expect(await screen.findByText("Count: 2")).toHaveTextContent("Count: 2");
    });
});
```

The same pattern scales from a counter to the full Tasks app in the [tutorial](/v2/tutorial/testing).

## Next

[MCP](/v2/guide/mcp) exposes these same queries and events to an AI agent, so it can drive your running app instead of a test doing it.
