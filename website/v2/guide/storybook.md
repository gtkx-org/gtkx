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

Start the explorer with `npx gtkx storybook`; add [`--headless --size 1280x900`](/v2/guide/cli#gtkx-storybook) when you need a private display. It finds story files such as `src/button.stories.tsx` under `src` without configuration. To choose other files, create `.storybook/main.ts`:

```ts
import { defineConfig } from "@gtkx/storybook/config";

export default defineConfig({
    stories: ["src/components/**/*.stories.tsx"],
});
```

Patterns are relative to the GTKX project root. Your `gtkx.config.ts` still defines the application settings and additional GIR libraries. [Asset imports](/v2/guide/assets) work as they do in the application.

The explorer registers under the project's application ID with a `.Storybook` suffix, so it can run alongside `gtkx dev`. A running explorer exposes the [GTKX MCP server](/v2/guide/mcp) for live widget inspection and interaction.

### Stories from a shared package

In a [monorepo](/v2/guide/workspaces#monorepos), an app's patterns can reach the stories of a shared component package, as Storybook monorepo configurations do:

```ts
export default defineConfig({
    stories: ["src/**/*.stories.tsx", "../../packages/ui/src/**/*.stories.tsx"],
});
```

Every matched file must lie inside the workspace root, the directory holding `pnpm-workspace.yaml` or the `package.json` with `workspaces`; the explorer stops with an error naming any file outside it. The explorer runs with the app's `gtkx.config.ts`, so the app has to declare the libraries the shared stories import. Stories without a `title` are named by their path from the workspace root, such as `packages/ui/src/badge`.

To browse a shared package's stories on their own, set it up as a [component library](/v2/guide/workspaces#component-libraries), add `@gtkx/storybook` as a development dependency and run `gtkx storybook` in its directory. It needs no `applicationId`; its explorer registers as `org.gtkx.Library.Storybook`.

## Define stories

Keep each component in its own module so that Fast Refresh updates it in place. Write a component in `src/button.tsx`:

```tsx
import { GtkButton } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";

type ButtonProps = {
    label: string;
    enabled: boolean;
    onClicked?: () => void;
};

const Button = ({ label, enabled, onClicked }: ButtonProps): ReactNode => (
    <GtkButton label={label} sensitive={enabled} onClicked={onClicked} />
);

export { Button };
```

and its stories in `src/button.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@gtkx/storybook";
import { Button } from "./button.js";

const meta = {
    title: "Components/Button",
    component: Button,
    args: { label: "Save", enabled: true },
    argTypes: {
        label: { control: "text" },
        enabled: { control: "boolean" },
        onClicked: { action: "clicked" },
    },
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;

const Default = {} satisfies Story;
const Disabled = { args: { enabled: false } } satisfies Story;

export default meta;
export { Default, Disabled };
```

An argument gets a native control only when its `argTypes` entry sets [`control`](https://storybook.js.org/docs/api/arg-types#control): `boolean`, `text`, `number` or `range`, and `select`, `radio` or `inline-radio`. The explorer does not infer controls from the args, so an argument without `control` has none and needs no `control: false`. `argTypes.onClicked.action` records callback calls in the action panel; asynchronous callbacks are recorded once when they settle. You can also provide `action("clicked")` from `@gtkx/storybook` directly as an argument.

Shared preview configuration belongs in `.storybook/preview.tsx`, exported as an object satisfying `Preview` from `@gtkx/storybook`. [Decorators](https://storybook.js.org/docs/writing-stories/decorators) return ordinary GTKX JSX and receive the resolved story context.

Controls preserve absent arguments until you edit them. Choice controls display a placeholder for an unset value; selecting it clears the argument. Set `table.readonly: true` on an argument's metadata to show a disabled control, or `table.disable: true` to hide it. A [conditional](https://storybook.js.org/docs/api/arg-types#if) `if` on an argument hides its control, and leaves the argument unset, while its arg or global condition is false.

The explorer lists stories whose [tags](https://storybook.js.org/docs/writing-stories/tags) include `dev`, which every story has by default. Add `tags: ["!dev"]` to a story or its metadata to leave it out of the navigator; `composeStories` still returns it.

The navigator shows one group per story `title`. Titles that share a path, such as `Recipes/Card` and `Recipes/Grid`, stay next to each other, and the first story file under each path decides where the path appears, as in Storybook's sidebar.

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

    await userEvent.click(
        screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" }),
    );

    expect(clicks).toBe(1);
});
```

Pass shared preview configuration as the second argument to `composeStories`. Render a window story as any component that creates its own window, with `{ container: rootElement }` from `@gtkx/react`; a story whose window is an `AdwApplicationWindow` also needs an `<AdwApplication>` around it, as in the [Testing guide](/v2/guide/testing#rendering-a-component).

## Lifecycle and compatibility

Control edits rerender the current story and retry previews that failed to render. Reset restores default arguments and remounts it. Switching stories unmounts the previous preview, including its windows and dialogs.

Content stories render inside the explorer window and receive its application and parent-window contexts. They get a margin; set Storybook's [`layout`](https://storybook.js.org/docs/configure/story-layout) parameter to `"centered"` or `"fullscreen"` to center the story or drop the margin. A story owning a separate window sets `parameters: { gtkx: { preview: "window" } }`.

A content story whose component has its own header bar, such as a page split out of a window, shows the explorer's window controls in it, and they act on the explorer window: its close button closes the explorer. Pass `showStartTitleButtons` and `showEndTitleButtons` through to the header bar and set them to `false` in the story's `args`, or render the whole window in a `preview: "window"` story. Give a window story a component that does not call `quit()`, such as a window without the scaffold's `onCloseRequest={quit}`. `quit()` unmounts every root in the process and quits their applications, so it stops the explorer instead of closing the story.

GTKX reuses Storybook 10's composition APIs. This is a standalone native explorer. Browser addons, a browser manager, MDX, Autodocs, `play`, loaders, Storybook preview hooks, and static interactive publishing are unsupported. The explorer skips `.mdx` files matched by `stories` patterns and prints a warning naming them, so a configuration copied from Storybook works unchanged. Configured globals are available in context; there is no global toolbar.

The [example project](https://github.com/gtkx-org/gtkx/tree/main/examples/storybook) demonstrates controls, dialog and window stories, and native integration tests.
