# Portable GTKX stories

`@gtkx/storybook` turns imported CSF3 stories into React components for native GTKX applications and integration tests. This is the first implementation phase of [issue #654](https://github.com/gtkx-org/gtkx/issues/654). The native story explorer, discovery command, controls, and action panel are still planned; see the [implementation plan](plans/654-storybook.md).

The package adapts the public composition APIs from pinned `storybook@10.6.0`. Storybook combines the story annotations; `@gtkx/react` renders the resulting elements as real widgets. There is no browser preview or browser shim.

## Author a story

Create a normal GTKX component in `counter.tsx`:

```tsx
import type { ReactNode } from "react";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useState } from "react";

type CounterProps = {
    label: string;
    step?: number;
};

const Counter = ({ label, step = 1 }: CounterProps): ReactNode => {
    const [count, setCount] = useState(0);

    return (
        <GtkButton
            label={`${label}: ${String(count)}`}
            onClicked={() => setCount((value) => value + step)}
        />
    );
};

export { Counter };
```

Define its metadata and examples in `counter.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@gtkx/storybook";
import { Counter } from "./counter.js";

const meta = {
    title: "Components/Counter",
    component: Counter,
    args: { label: "Increment", step: 1 },
    argTypes: {
        label: { control: "text" },
        step: { control: "number" },
    },
    parameters: { category: "examples" },
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

`Meta` describes the component and its defaults. `StoryObj` describes an object story and infers the component's arguments from the metadata. The default renderer uses `component`; a story or metadata object can supply an explicit `render(args, context)` instead. Give metadata an explicit title because this phase does not infer titles from file paths.

An explicit `argTypes` object is preserved as story metadata. It does not create a control panel yet. Parameters are also data: a `layout` or addon parameter only affects behavior when a renderer or decorator consumes it.

## Pass preview configuration explicitly

Create shared configuration in a regular imported module, such as `preview.tsx`:

```tsx
import type { Preview } from "@gtkx/storybook";
import { GtkBox } from "@gtkx/jsx/gtk";

const preview = {
    args: { step: 2 },
    parameters: { theme: { density: "comfortable" } },
    initialGlobals: { locale: "en" },
    decorators: [
        (Story) => (
            <GtkBox marginTop={12} marginBottom={12}>
                <Story />
            </GtkBox>
        ),
    ],
} satisfies Preview;

export default preview;
```

Pass this object to each composition. Configuration is explicit and scoped to that call; the package does not register a singleton preview or automatically load `.storybook/preview.ts`.

Arguments apply in preview, component, then story order, followed by props supplied to the composed component. In this example the component's `step: 1` overrides the preview's `step: 2`, and `ByFive` overrides both with `step: 5`. Parameters use Storybook's merging behavior. Preview, component, and story decorators receive the resolved context and surround the rendered story. `initialGlobals` supplies preview defaults; component/story `globals` can override them for context consumers.

## Render and interact with native widgets

With the project's normal GTKX Vitest configuration, import the same stories in `counter.test.tsx`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { composeStories } from "@gtkx/storybook";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, it } from "vitest";
import * as stories from "./counter.stories.js";
import preview from "./preview.js";

const { Default } = composeStories(stories, preview);

it("updates the counter and changes its arguments", async () => {
    const result = await render(<Default />);

    await userEvent.click(
        screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment: 0" }),
    );
    expect(
        screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment: 1" }),
    ).toBeDefined();

    await result.rerender(<Default label="Add five" step={5} />);
    await userEvent.click(
        screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Add five: 1" }),
    );
    expect(
        screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Add five: 6" }),
    ).toBeDefined();

    await result.unmount();
    expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON)).toBeNull();
});
```

Compose outside the component's render function so the story component has a stable identity. Rerendering it with new props preserves ordinary React state. Unmounting and remounting, or changing its React `key`, resets that state through React's normal lifecycle. Hooks imported from `react` work in components and story renders; Storybook preview hooks are outside the supported subset.

The same render result supports native screenshots. Capture before unmounting with `await result.screenshot({ path: "artifacts/counter.png" })`. Queries, events, screenshots, and cleanup use `@gtkx/testing`; there is no DOM canvas or separate Storybook test runner.

To compose one story, pass its export name explicitly when it should determine the story identifier and default display name:

```tsx
import { composeStory } from "@gtkx/storybook";
import * as stories from "./counter.stories.js";
import preview from "./preview.js";

const ByFive = composeStory(stories.ByFive, stories.default, preview, "ByFive");
```

The public signatures are `composeStory(story, meta, preview?, exportName?)` and `composeStories(module, preview?)`. `composeStories` applies metadata's `includeStories` and `excludeStories` selection. Use those fields when a story module also exports helper values. The composed components expose their story metadata, including `args`, `argTypes`, `parameters`, and their identifiers and names. Following upstream portable-story behavior, `.storyName` retains the supplied export name, such as `ByFive`; the decorator/render context's `name` holds the display name, such as `Count by five`.

## Application and window ownership

Composition returns a React component and does not create an application or a window. In an application, mount it under the appropriate `AdwApplication` and `AdwApplicationWindow` shell. The caller supplies any providers or wrappers the component needs, directly or through decorators.

For simple widget stories, `@gtkx/testing` supplies its normal harness window. Stories using `useApplication`, application windows, or dialogs need the corresponding application/window context from the caller. Storybook composition does not replace GTKX's normal toplevel ownership, presentation, or cleanup rules.

## Supported boundary

This phase supports explicitly imported CSF3 object stories, component/default renders, explicit renders, args and overrides, explicit argTypes, parameters, decorators, preview configuration, and globals supplied as configuration. Native render, rerender, interactions, unmount, and screenshots come from existing GTKX APIs.

The following work remains in the [issue plan](plans/654-storybook.md):

- Story discovery, automatic titles, configuration-file loading, and a development command.
- A native explorer, story selection/reset, automatic wrappers, and preview error presentation.
- Controls, action recording, a global toolbar, and inferred argument types.
- Story-specific HMR, new-file discovery updates, and explorer state persistence.
- Storybook's `.run()` lifecycle, `play`, loaders, preview hooks, CSF2 function stories, and CSF Next factories.
- Browser manager/addon compatibility, DOM interaction/accessibility tools, MDX, Autodocs, and interactive static publishing.

Addon compatibility needs native integration and individual validation. The pinned upstream public composition API is reused; internal type imports and the internal CSF export-selection helper are isolated in the package's adapters. See the [package source](../packages/storybook/src/index.ts), [CSF documentation](https://storybook.js.org/docs/api/csf), and [Storybook framework architecture](https://storybook.js.org/docs/contribute/framework).
