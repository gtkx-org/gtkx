---
title: "Storybook"
description: "Browse native GTKX component stories, edit arguments, record actions, and reuse the same stories in integration tests."
---

# Storybook

`@gtkx/storybook` runs [CSF3 component stories](https://storybook.js.org/docs/api/csf) in a native Adwaita explorer. It supplies a story navigator, a preview, controls, and an action panel, using the same GTKX runtime and generated bindings as your application.

## Start the explorer

In an existing GTKX project:

```sh
npm install -D @gtkx/storybook@beta
```

Create `.storybook/main.ts`:

```ts
import { defineConfig } from "@gtkx/storybook/config";

export default defineConfig({
    stories: ["src/**/*.stories.tsx"],
});
```

Patterns are relative to the GTKX project root. Your `gtkx.config.ts` still defines the application settings and additional GIR libraries. [Asset imports](/v2/guide/assets) work as they do in the application. Start the explorer with `npx gtkx storybook`; add `--headless --size 1280x900` when you need a private display.

## Define stories

For a component accepting `label`, `enabled`, and `onClicked`, write `button.stories.tsx`:

```tsx
import { GtkButton } from "@gtkx/jsx/gtk";
import type { Meta, StoryObj } from "@gtkx/storybook";
import type { ReactNode } from "react";

type ButtonProps = {
    label: string;
    enabled: boolean;
    onClicked?: () => void;
};

const Button = ({ label, enabled, onClicked }: ButtonProps): ReactNode => (
    <GtkButton label={label} sensitive={enabled} onClicked={onClicked} />
);

const meta = {
    title: "Components/Button",
    component: Button,
    args: { label: "Save", enabled: true },
    argTypes: {
        label: { control: "text" },
        enabled: { control: "boolean" },
        onClicked: { action: "clicked", control: false },
    },
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;

const Default = {} satisfies Story;
const Disabled = { args: { enabled: false } } satisfies Story;

export default meta;
export { Default, Disabled };
```

For component Fast Refresh, keep the component in its own module and import it into the story. Explicit `argTypes` create native boolean, text, number, and select controls. `argTypes.onClicked.action` records callback calls; asynchronous callbacks are recorded once when they settle. You can also provide `action("clicked")` from `@gtkx/storybook` directly as an argument.

Shared preview configuration belongs in `.storybook/preview.tsx`, exported as an object satisfying `Preview` from `@gtkx/storybook`. [Decorators](https://storybook.js.org/docs/writing-stories/decorators) return ordinary GTKX JSX and receive the resolved story context.

Controls preserve absent arguments until you edit them. Choice controls display a placeholder for an unset value; selecting it clears the argument. Set `table.readonly: true` on an argument's metadata to show a disabled control, or `table.disable: true` to hide it. A [conditional](https://storybook.js.org/docs/api/arg-types#if) `if` on an argument hides its control, and leaves the argument unset, while its arg or global condition is false.

The explorer lists stories whose [tags](https://storybook.js.org/docs/writing-stories/tags) include `dev`, which every story has by default. Add `tags: ["!dev"]` to a story or its metadata to leave it out of the navigator; `composeStories` still returns it.

## Reuse stories in native tests

With the [GTKX Vitest setup](/v2/guide/testing), import and compose the same module:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { composeStories } from "@gtkx/storybook";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, it } from "vitest";
import * as stories from "./button.stories.js";

const { Default } = composeStories(stories);

it("invokes the button callback", async () => {
    let clicks = 0;
    await render(<Default onClicked={() => { clicks += 1; }} />);

    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" }));

    expect(clicks).toBe(1);
});
```

Pass shared preview configuration as the second argument to `composeStories`. Native queries, events, screenshots, and cleanup come from `@gtkx/testing`. A running explorer also exposes the [GTKX MCP server](/v2/guide/mcp) for live widget inspection and interaction. The explorer's application ID is the project's ID with a `.Storybook` suffix, so it can run alongside `gtkx dev`; pass that ID as `applicationId` to target the explorer.

## Lifecycle and compatibility

Control edits rerender the current story and retry previews that failed to render. Reset restores default arguments and remounts it. Switching stories unmounts the previous preview, including its windows and dialogs. Content stories receive the explorer's application and parent-window contexts; a story owning a separate window sets `parameters: { gtkx: { preview: "window" } }`. Give a window story a component that does not call `quit()`, such as a window without the scaffold's `onCloseRequest={quit}`. `quit()` unmounts every root in the process, so it stops the explorer instead of closing the story.

GTKX reuses Storybook 10's composition APIs. This is a standalone native explorer. Browser addons, a browser manager, MDX, Autodocs, `play`, loaders, Storybook preview hooks, and static interactive publishing are unsupported. The explorer skips `.mdx` files matched by `stories` patterns and prints a warning naming them, so a configuration copied from Storybook works unchanged. Configured globals are available in context; there is no global toolbar.

The [example project](https://github.com/gtkx-org/gtkx/tree/main/examples/storybook) demonstrates controls, dialog and window stories, and native integration tests.
