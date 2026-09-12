# Native GTKX stories

`@gtkx/storybook` provides a native Adwaita explorer for CSF3 component stories. Run the explorer to browse real widgets, edit arguments, inspect actions, and develop with GTKX's Vite runtime. Import those same stories into native integration tests with `composeStory` or `composeStories`.

The package adapts composition from pinned `storybook@10.6.0`. GTKX supplies the renderer, development command, explorer, controls, and testing tools. An interactive preview needs a running GTKX process; screenshots and documentation can be published independently.

## Install and configure

In an existing GTKX application, install the package alongside the GTKX CLI:

```sh
npm install -D @gtkx/storybook@beta
```

Keep the application's `gtkx.config.ts`, including its GIR libraries, resources, and settings. Create `.storybook/main.ts`:

```ts
import { defineConfig } from "@gtkx/storybook/config";

export default defineConfig({
    stories: ["src/**/*.stories.tsx"],
    exclude: ["src/private/**"],
});
```

Paths and patterns are relative to the GTKX project root, including paths in a configuration file under `.storybook`. `stories` defaults to `src/**/*.stories.{ts,tsx,js,jsx,mts,mjs}`. Optional shared preview configuration is discovered as `.storybook/preview.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, or `.mjs`; `preview` can specify a different project-relative file.

Start the explorer:

```sh
npx gtkx storybook
```

Use the same command on a private headless display:

```sh
npx gtkx storybook --headless --size 1280x900
```

`--cwd` selects a project root, `--config` selects the GTKX configuration, and `--storybook-config` selects a Storybook main configuration. The command needs no application entry file. It prepares the project's generated bindings and uses the normal GTKX resources, settings, CSS, React compiler, and development runtime.

The [example workspace](../examples/storybook) includes a counter, a confirmation dialog, a separate window, shared decorators, controls, actions, and native tests. From a repository checkout, run `pnpm nx dev storybook-example` and `pnpm nx test storybook-example`.

## Author a story

Create an ordinary GTKX component in `counter.tsx`:

```tsx
import { GtkButton } from "@gtkx/jsx/gtk";
import { type ReactNode, useState } from "react";

type CounterProps = {
    label: string;
    step: number;
    enabled: boolean;
    onIncrement?: (count: number) => void;
};

const Counter = ({ label, step, enabled, onIncrement }: CounterProps): ReactNode => {
    const [count, setCount] = useState(0);

    return (
        <GtkButton
            label={`${label}: ${String(count)}`}
            sensitive={enabled}
            onClicked={() => {
                const nextCount = count + step;
                setCount(nextCount);
                onIncrement?.(nextCount);
            }}
        />
    );
};

export { Counter };
```

Define metadata and examples in `counter.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@gtkx/storybook";
import { Counter } from "./counter.js";

const meta = {
    title: "Components/Counter",
    component: Counter,
    args: { label: "Increment", step: 1, enabled: true },
    argTypes: {
        label: { control: "text" },
        step: { control: { type: "number", min: 1, max: 20 } },
        enabled: { control: "boolean" },
        onIncrement: { action: "incremented", control: false },
    },
} satisfies Meta<typeof Counter>;

type Story = StoryObj<typeof meta>;

const Default = {} satisfies Story;
const ByFive = {
    name: "Count by five",
    args: { step: 5 },
} satisfies Story;

export default meta;
export { Default, ByFive };
```

`Meta` describes the component and its defaults. `StoryObj` infers argument types from the metadata. The default renderer uses `component`; metadata or a story can instead supply `render(args, context)`. Keep React components in their own modules so component edits can use Fast Refresh.

The explorer discovers files deterministically and derives a title from the project-relative filename when metadata omits `title`. Explicit titles control navigation grouping; `name` controls a story's display name. `id` on metadata supplies a stable component identifier. Duplicate story identifiers and invalid exports are reported through the explorer's loading error state.

Use metadata's `includeStories` and `excludeStories` when a module exports values other than story objects. CSF2 function stories are unsupported.

## Decorators, globals, and defaults

Create `.storybook/preview.tsx`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwClamp } from "@gtkx/jsx/adw";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import type { Preview } from "@gtkx/storybook";

const preview = {
    initialGlobals: { collection: "Component gallery" },
    parameters: { theme: { density: "comfortable" } },
    decorators: [
        (Story, context) => (
            <AdwClamp maximumSize={540}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                    <GtkLabel label={String(context.globals.collection)} />
                    <Story />
                </GtkBox>
            </AdwClamp>
        ),
    ],
} satisfies Preview;

export default preview;
```

The explorer loads this object automatically. Portable composition accepts it explicitly, keeping configuration scoped to each call without a singleton preview registry.

Arguments apply in preview, component, then story order, followed by overrides supplied to the composed component. Parameters use Storybook's merging behavior. Preview, component, and story decorators receive the resolved context and wrap the rendered story. `initialGlobals` supplies preview defaults; component and story `globals` override them for context consumers. Configured globals are available to decorators and renders; there is no editable global toolbar.

A decorator is ordinary JSX and can supply context providers, spacing, or application-specific styling. The explorer recognizes `parameters.layout: "centered"` and `"fullscreen"` for preview alignment and spacing. Other parameters and arbitrary addon settings have no effect unless a decorator or the native explorer implements them.

## Native controls

Controls come from explicit `argTypes`; argument types are not inferred from React components or GIR metadata.

| Declaration | Native control |
| --- | --- |
| `{ control: "boolean" }` | Boolean toggle |
| `{ control: "text" }` | Text entry |
| `{ control: { type: "number", min: 1, max: 100, step: 1 } }` | Numeric input with optional bounds |
| `{ control: "select", options: ["tasks", "pages", "minutes"] }` | Choice selector |
| `{ control: false }` | No editable control |

`range` uses the numeric input. `radio` and `inline-radio` use the choice selector. Set `table.disable: true` to hide a control or `control: { type: "text", disable: true }` to display it disabled.

Changing a control rerenders the selected story with the edited arguments. Ordinary React component state remains mounted during argument changes. Reset restores the composed defaults and remounts the preview. Switching stories discards edited arguments; returning starts from that story's composed defaults.

Native objects, functions, and complex object arguments are not JSON-editable controls. Supply them through story args, render functions, or decorators. Invalid numeric inputs and unsupported values do not become arbitrary native widget properties.

## Actions

Declare a callback action explicitly in `argTypes`:

```ts
argTypes: {
    onIncrement: { action: "incremented", control: false },
}
```

The explorer supplies a recording callback when the argument has no handler and records calls to configured handlers. Existing handlers continue to run. Asynchronous callbacks are recorded once when they settle. Actions are scoped to the selected story and displayed in the Actions panel, keeping at most 100 entries. Switching stories or resetting clears the history.

Alternatively, put a named action directly in the story's args:

```ts
import { action } from "@gtkx/storybook";

const Default = {
    args: { onIncrement: action("incremented") },
} satisfies Story;
```

Use this form to give a callback an explicit identity in reusable stories. Native signal arguments are summarized for inspection: native instances become class labels, and plain values are inspected with bounded depth and length. The history stores these strings without taking native object ownership. Outside the explorer, `action(name)` is a no-op callback. In a portable integration test, override it with a real callback when you need to observe the result.

Actions are explicit. The package does not automatically intercept every GTK signal or infer action names from prop naming conventions. Callbacks without an explicit action are passed through unchanged, including their return values and errors. Configured action failures are shown in the preview and recorded in the action panel; reset or select another story to recover.

## Preview ownership and lifecycle

The explorer supplies `AdwApplication`, `AdwApplicationWindow`, and the application's parent-window context. Ordinary widget stories render inside the shared preview. Components can use their normal React providers and GTKX hooks under that shell.

A story that owns a separate window declares:

```tsx
import { AdwHeaderBar, AdwToolbarView, AdwWindow } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import type { Meta, StoryObj } from "@gtkx/storybook";

const meta = {
    title: "Windows/Example",
    parameters: { gtkx: { preview: "window" } },
    render: () => (
        <AdwWindow title="Example" defaultWidth={400} defaultHeight={240}>
            <AdwToolbarView topBar={<AdwHeaderBar />}>
                <GtkLabel label="A separate native window" />
            </AdwToolbarView>
        </AdwWindow>
    ),
} satisfies Meta;

const Default = {} satisfies StoryObj<typeof meta>;

export default meta;
export { Default };
```

Window elements use GTKX's normal portals and presentation lifecycle. A decorator that adds ordinary widget chrome should skip the wrapper for window stories; the example's preview shows that check. Dialogs can be opened from a content story by conditionally rendering `AdwDialog`, which receives the explorer's parent-window context. Remove it from JSX to close it. Use `onClosed` to synchronize component state when a user dismisses it. A story that directly renders a dialog can use `parameters.gtkx.preview: "dialog"`.

Switching stories unmounts the previous preview, closing its windows and dialogs and clearing local React state. Reset remounts the selected story with default arguments. A render failure is contained within the preview so navigation remains available; edit its controls to retry with corrected arguments, select another story, or reset the preview. Full `AdwApplication` stories require an independent application process and are outside the shared explorer.

Portable composition creates neither an application nor a window. When using composed stories in your own application, supply the shell and providers yourself. `@gtkx/testing` supplies its normal harness window for ordinary widget stories; application-window stories need an application wrapper and the appropriate render container.

## Development updates

Component modules use GTKX's ordinary Fast Refresh path. Editing story metadata or `.storybook/preview` recomposes the catalog. Story file additions, removals, and renames refresh discovery. The development process watches configuration and supports recovery after syntax and import errors.

Preservation depends on the kind of update: component-only refresh can preserve compatible React state, while replacing a story remounts its preview. A required process restart clears in-memory controls, action history, and component state. Avoid relying on preserved state as persistent application data.

## Native integration tests and screenshots

Use the project's normal GTKX Vitest configuration and import the stories directly:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { composeStories } from "@gtkx/storybook";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, it } from "vitest";
import * as stories from "./counter.stories.js";
import preview from "../.storybook/preview.js";

const { Default } = composeStories(stories, preview);

it("updates the counter and changes its arguments", async () => {
    const result = await render(<Default />);

    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment: 0" }));
    expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment: 1" })).toBeVisible();

    await result.rerender(<Default label="Add five" step={5} />);
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Add five: 1" }));
    expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Add five: 6" })).toBeVisible();

    await result.screenshot({ path: "artifacts/counter.png" });
    await result.unmount();
    expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON)).toBeNull();
});
```

Compose outside the component's render function to preserve its identity. Rerendering with new props preserves ordinary React state; unmounting, remounting, or changing a React `key` resets it. Hooks imported from `react` work in components and story renders.

To compose one story, pass its export name when that should determine its identifier and default display name:

```tsx
import { composeStory } from "@gtkx/storybook";

const ByFive = composeStory(stories.ByFive, stories.default, preview, "ByFive");
```

The public signatures are `composeStory(story, meta, preview?, exportName?)` and `composeStories(module, preview?)`. Composed components expose `args`, `argTypes`, `parameters`, `globals`, `id`, `storyName`, and `tags`. Following upstream portable composition, `.storyName` retains the supplied export name; render/decorator context's `name` contains the display name.

Queries, events, screenshots, and cleanup come from `@gtkx/testing`. A running `gtkx storybook` process also exposes GTKX's MCP server, so live widget-tree inspection, story selection, control edits, preview clicks, and screenshots use the same native automation as `gtkx dev`.

## Compatibility

| Feature | Support |
| --- | --- |
| CSF3 object stories, args, parameters, decorators, explicit renders | Supported through pinned Storybook composition |
| Native explorer, explicit controls/actions, live GTKX automation | Implemented by GTKX |
| Native integration tests and screenshots | Existing `@gtkx/testing` APIs |
| React hooks and component Fast Refresh | GTKX's React runtime |
| Configured globals | Available in story context; no global toolbar |
| Storybook preview hooks, `.run()`, loaders, `play` | Unsupported |
| CSF2 function stories and CSF Next factories | Unsupported |
| Browser manager, browser addons, DOM testing/accessibility tools | Require separate native integrations |
| MDX, Autodocs, interactive static publishing | Unsupported |

The public Storybook preview composition API is reused. Type-only internal imports and the internal CSF export-selection and display-name helpers are isolated in adapters, with an exact upstream dependency pin. Updating Storybook requires rerunning native composition and development integration coverage.

Browser addons are not enabled by installing this package. Controls and actions are native implementations; they do not establish compatibility with corresponding browser addon packages. A different addon or preview engine needs its own integration and validation before it is advertised as supported.
