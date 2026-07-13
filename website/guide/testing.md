---
description: "The @gtkx/testing and @gtkx/vitest reference: headless GTK test setup, render semantics, the full query and userEvent surface, custom matchers, and debugging helpers."
---

# Testing

GTKX tests run against real GTK. There is no fake widget tree and no mocked renderer: `render` mounts your components into live GObject widgets inside a headless Wayland display, queries walk the actual accessibility tree GTK exposes to screen readers, and `userEvent` dispatches the same gestures and key events a person would produce. The API is deliberately shaped like React Testing Library, so if you have tested a React web app, you already know the model: query by role and accessible name, interact through user events, assert on what the user can observe.

Two packages divide the work. `@gtkx/testing` is the library you import in test files: `render`, `screen`, `userEvent`, `fireEvent`, `waitFor`, and a set of widget-aware matchers. `@gtkx/vitest` is a Vitest plugin that gives every test worker its own isolated GTK display. For a walkthrough of testing a complete app, see the [tutorial's testing chapter](/tutorial/testing); this page is the reference for the full surface.

## Setup

A scaffolded project (answer yes to "Include testing setup" in `npm create gtkx`) ships this config:

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

`@gtkx/cli/vitest-plugin` combines the CLI's Vite plugins (the same ones `gtkx dev` and `gtkx build` use: the resolved app config and JSX metadata, GResource and GSettings modules, CSS imports, and the React Compiler) with the `@gtkx/vitest` plugin. The latter is where the interesting machinery lives. It configures the `forks` pool with `globals: true` and 30 second test and hook timeouts, and it injects a preload script into each worker process that boots a private headless environment before any test code loads: an isolated `XDG_RUNTIME_DIR`, a dedicated `dbus-daemon` session bus, and a headless Wayland compositor (weston with the pixman software renderer by default, or sway). Every worker gets its own compositor and bus, so tests in different files cannot interfere through shared display state, and the whole stack is torn down when the worker exits. The plugin also pins the environment GTK needs to behave deterministically off-screen: `GDK_BACKEND=wayland`, `GSK_RENDERER=cairo`, `GTK_A11Y=test`, `GSETTINGS_BACKEND=memory`, and software-only GL.

`@gtkx/vitest` accepts two options: `size`, the headless output resolution as a `"WIDTHxHEIGHT"` string (default `"1024x768"`), and `compositor`, either `"weston"` (the default) or `"sway"`; `@gtkx/cli/vitest-plugin` takes no options and applies those defaults. Headless runs need the compositor binary, `dbus-daemon`, and `setpriv` installed on the host.

Importing `@gtkx/testing` registers everything else for you: it hooks `afterEach` to clean up renders, hooks `afterAll` to quit the GTK loop, and extends `expect` with the widget matchers. There is no setup file to write.

## Rendering and cleanup

`render` is async and must be awaited, because mounting real widgets means flushing React's work through the live GTK loop before the promise resolves:

```tsx
import { render, screen } from "@gtkx/testing";

const { unmount, rerender, debug } = await render(<MyPanel />);
```

With no options, `render` creates an 800x600 harness `Gtk.Window` (with a plain header bar) and presents your element inside it. That works for any component that renders widgets. A top-level app component is different: `<AdwApplication>` is not a widget, so it cannot live inside a harness window. Render it into `rootElement` from `@gtkx/react` instead, which mounts it the same way `createRoot()` does in production:

```tsx
import { rootElement } from "@gtkx/react";

await render(<App />, { container: rootElement });
```

`RenderOptions` also accepts `baseElement` (the root that queries search, defaulting to all open toplevels, so dialogs and popovers are always findable), `wrapper` (a component to wrap the element in, useful for context providers), `reactStrictMode`, `onCaughtError` and `onRecoverableError` callbacks, and `queries` for binding custom query functions into the result. Widget animations are disabled by default so tests never wait on transitions; pass `animations: true` to opt back in.

The returned `RenderResult` carries every query bound to the render, plus `container`, `baseElement`, `unmount()`, `rerender(element)`, and the debug helpers described below. You rarely destructure it, because `screen` proxies to the most recent render and is the idiomatic way to query. `within(container)` binds the same queries to any subtree when you need to scope a search, and `renderHook(callback)` renders a hook into a throwaway `Gtk.Box` and returns `{ result, rerender, unmount }` for testing hooks in isolation.

Cleanup is automatic. The registered `afterEach` unmounts every active render, destroys the harness windows, resets `screen`, and clears the clipboard, so each test starts from an empty display.

## Queries

Six query kinds, each in six variants (`getBy`, `getAllBy`, `queryBy`, `queryAllBy`, `findBy`, `findAllBy`), cover the widget tree:

| Kind | Matches |
|---|---|
| `ByRole` | A `Gtk.AccessibleRole`, optionally narrowed by name and accessible state |
| `ByLabelText` | A widget labeled by a `Gtk.Label` mnemonic, an `accessibleLabel`, or `accessibleLabelledBy` |
| `ByText` | The label text of LABEL-role widgets |
| `ByName` | The widget's `name` property (the `name` prop) |
| `ByPlaceholderText` | The placeholder of an editable widget |
| `ByDisplayValue` | The current text of an editable widget or `GtkTextView` |

The variants have Testing Library semantics: `getBy*` returns synchronously and throws when nothing (or more than one thing) matches, `queryBy*` returns `null` when nothing matches (more than one match still throws), and `findBy*` polls until a match appears or the timeout elapses (1000 ms by default), which makes it the right default after any interaction that triggers a re-render. Every kind is also exported unbound, taking the container as its first argument.

Roles are always `Gtk.AccessibleRole` enum values, never strings, because they are GTK's own accessibility vocabulary: a `GtkButton` reports `BUTTON`, a `GtkCheckButton` reports `CHECKBOX`, an `AdwActionRow` reports `LIST_ITEM`. The accessible name is computed the way assistive technology sees it: an explicit `accessibleLabel` wins, then the widget's own label, text, or title, then the joined text of its descendant labels (with mnemonic underscores stripped), then its tooltip. Widgets that are hidden or excluded from the accessibility tree are skipped unless you pass `{ hidden: true }`.

`ByRole` accepts the richest options object: `name` narrows by accessible name, and `checked`, `pressed`, `selected`, `expanded`, `level`, `busy`, `description`, and `value: { now, min, max, text }` narrow by accessible state read live from the widget (a `CHECKBOX` is checked when the underlying `GtkCheckButton` is active, a `ROW` is selected when GTK's selection state flag is set, and so on).

Text matchers are a `string` or number, a `RegExp`, or a predicate function, with `MatcherOptions` controlling exactness and normalization (`exact` defaults to `true`; `trim` and `collapseWhitespace` are applied by the default normalizer).

```tsx
import * as Gtk from "@gtkx/gi/gtk";

const save = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" });
const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
const entry = screen.getByPlaceholderText("Search tasks");
expect(screen.queryByText("Deleted task")).toBeNull();
```

## Simulating input with userEvent

Every `userEvent` helper first waits for the widget to be actionable, polling for up to 500 ms (configurable via `actionabilityTimeout`) until it is sensitive, its window has been allocated a size, it is mapped on screen, and its window is active. If any check never passes, the helper throws an error naming the failed condition, which turns "my click silently did nothing" into a precise diagnosis. The interaction itself runs inside React's `act`, so resulting state updates are flushed before the promise resolves.

The surface, grouped by what it drives:

- **Clicking**: `click`, `dblClick`, `tripleClick`. A `GtkButton` receives a real press/release gesture, a `GtkSwitch` toggles, and anything else is activated directly or through its nearest clickable ancestor.
- **Text**: `type(widget, text, options?)`, `clear`, `copy`, `cut`, `paste(widget, text?)`. These require a `Gtk.Editable` or `Gtk.TextView` and use the real clipboard, which is reset between tests.
- **Keyboard**: `keyboard(widget, input)` types characters and named keys (`{Enter}`, `{Tab}`, `{Escape}`, `{Backspace}`, arrows, `{Home}`, `{PageUp}`, `{F1}` through `{F12}`, and held modifiers like `{Control>}a{/Control}`). Key events are emitted on a key controller and matched against the widget's and its ancestors' shortcut controllers, so real GTK key bindings fire: an `{ArrowUp}` genuinely moves a `GtkScale`. `tab(widget, { shift })` moves focus.
- **Pointer**: `pointer(widget, input)` supports left-button tokens only (`"click"`, `"down"`, `"up"`, and their `[MouseLeft]` forms). Pointer input goes through `GestureClick` controller signals rather than real `GdkEvent`s, so coordinates, motion, and other buttons cannot be synthesized headless.
- **Gestures**: `hover`/`unhover`, `rotate`, `zoom`, `swipe`, `longPress`, `drag(widget, dx, dy)`. The last five drive a gesture controller that must already be attached to the widget. `drag` refuses a `Gtk.Range` because the built-in slider drag reads real pointer coordinates; use `slide(range, value)` or `keyboard` for sliders.
- **Drag and drop**: `drop(widget, content)` and `dragAndDrop(source, target, content)` deliver a `GObject.Value` (strings, numbers, and booleans are wrapped automatically) to the target's `GtkDropTarget`; `dragAndDrop` also verifies the source carries a `GtkDragSource`.
- **Scrolling and selection**: `scroll(widget, { x, y })` adjusts the nearest scrollable's adjustments, `slide(range, value)` jumps a range, and `selectOptions`/`deselectOptions` select by index in `ListView`, `GridView`, `ColumnView`, `DropDown`, `ComboBox`, and `GtkListBox` (list views through their selection models).

## fireEvent, act, and waitFor

`fireEvent(object, signalName, ...args)` emits any GObject signal directly, with no actionability checks. Reach for it when the thing you are testing is a signal handler rather than a user interaction, or when the interaction has no `userEvent` equivalent: firing `"activated"` on a row, or `"close-request"` on a window. `userEvent` should still be your default, because it exercises the same event plumbing as production.

`act(callback)` is React's `act` with the environment flag managed for you; you need it only when you mutate state outside a `userEvent` or `fireEvent` call. `waitFor(callback, options?)` retries an assertion until it passes or times out, and `waitForElementToBeRemoved` resolves once a widget leaves the widget tree. Both default to the 1000 ms `asyncUtilTimeout`. `configure({ asyncUtilTimeout, actionabilityTimeout, throwSuggestions, getElementError })` adjusts the global defaults, which is useful in a shared setup file when a slow CI machine needs longer timeouts.

## Matchers

Importing `@gtkx/testing` extends `expect` with widget-aware matchers, so assertions read at the same level as queries:

```tsx
expect(label).toHaveTextContent(/world/);
expect(button).toHaveAccessibleName("Save");
expect(entry).toHaveDisplayValue("typed value");
expect(entry).toHavePlaceholderText("Search tasks");
expect(check).toBeChecked();
expect(toggle).toBePressed();
expect(expander).toBeExpanded();
expect(row).toBeSelected();
expect(scale).toHaveValue(50);
```

The four text matchers take a string or `RegExp` (`toHaveTextContent` matches substrings; the others match exactly) and assert non-emptiness when called with no argument. The boolean state matchers throw when the widget does not expose that state at all, which catches querying the wrong widget rather than silently passing.

## Debugging

When a query fails, look at the tree the way the queries see it. `screen.debug()` (also `logWidget` and `prettyWidget` for arbitrary widgets) prints an HTML-like dump of the widget tree annotated with roles, names, and accessibility attributes. `screen.logRoles()` groups every widget in the tree by role, which is the fastest way to answer "what role does this widget actually report?". `getSuggestedQuery(widget)` recommends the best query for a widget, preferring role, then label text, then the weaker kinds.

For visual inspection, `screen.screenshot()` renders the window off-screen, writes the PNG to a temp file, logs a `file://` path you can open, and returns the base64 image data; the lower-level `screenshot(widget)` returns the data without saving. For poking at a live dev session rather than a test, the [MCP server](/guide/mcp) exposes the same tree dumps, queries, and screenshots to any MCP client.

::: tip
`GTK_A11Y=test` is set by the Vitest plugin, and role queries read GTK's accessibility tree directly. Tests written this way double as a basic accessibility audit: if `getByRole` cannot find your widget by name, a screen reader user cannot either.
:::

## A worked example

The scaffolded starter's counter, tested end to end. The component under test is ordinary application code; the test renders it, finds the button by role, clicks it, and asserts on the resulting label text:

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
            <GtkLabel label={`Count: ${count}`} />
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

Nothing here is simulated: the click drives a real `GtkGestureClick` on a real `GtkButton`, React re-renders, GTK relabels the `GtkLabel`, and `findByText` reads the result off the live widget. The same pattern scales from a counter to the full Tasks app in the [tutorial](/tutorial/testing).
