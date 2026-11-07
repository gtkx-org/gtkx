---
title: "MCP"
description: "Inspect a running GTKX app and look up its generated bindings from your coding agent."
---

# MCP

`@gtkx/mcp` connects a coding agent to your running GTKX app. The agent can inspect widgets, interact with the window, take screenshots, and look up the exact bindings generated for your project.

## Setup

Install the server and the testing package used by its widget tools. Scaffolded projects may already include them.

::: code-group

```bash [npm]
npm install -D @gtkx/mcp@beta @gtkx/testing@beta
```

```bash [pnpm]
pnpm add -D @gtkx/mcp@beta @gtkx/testing@beta
```

```bash [yarn]
yarn add -D @gtkx/mcp@beta @gtkx/testing@beta
```

:::

From the project root, register the server with your client:

```bash
npx gtkx mcp init --client claude
```

[`--client`](/v2/guide/cli#gtkx-mcp-init) accepts `claude`, `cursor`, `vscode`, `opencode`, and `codex`. It preserves other server entries and the file's indentation, and replaces an older `gtkx` entry. A JSON file with comments is left unchanged, and the command prints the entry to add to it. A scaffolded project already includes the Claude configuration.

For Codex, the command writes a `[mcp_servers.gtkx]` table to the project's `.codex/config.toml`. Codex reads that file from the directory it starts in and every parent up to the Git root, but only in a project you trust: answer yes to Codex's trust prompt, which records `trust_level = "trusted"` for the project in `~/.codex/config.toml`. When the file already declares `gtkx` in another form, such as an inline table, a sub-table or a multi-line value, the command leaves the file unchanged and prints the table to use instead.

For another MCP client, configure a stdio server that runs `npx --no gtkx mcp` from the project root. Clients start servers without a terminal, where plain `npx` installs and runs a package named `gtkx` from the npm registry whenever `@gtkx/cli` is not installed; `--no` makes npx exit with an error instead. npx looks for the CLI in the project's `node_modules/.bin` and, inside an npm or Yarn workspace, in the workspace root's, where those package managers place it. pnpm installs it only in the app, so in a pnpm workspace start the server from the app's directory. The server reads the configuration and generated bindings of the directory it starts in, so a server for a workspace app runs in the app's directory, not at the workspace root. The first app scaffolded into a workspace also adds an entry to the root's `.mcp.json` that starts its server through the package manager, such as `pnpm --dir apps/my-app exec gtkx mcp`, and that one server serves every app of the workspace; see [Scaffold Options](/v2/guide/scaffold-options#workspaces). The standalone `gtkx-mcp` command is also available when `@gtkx/mcp` is installed directly.

Start the app in another terminal:

```bash
npx gtkx dev
```

The app connects automatically, and either side can start first. The connection is available during development; production builds exclude it.

For a session without a display, run [`npx gtkx dev --headless`](/v2/guide/cli#gtkx-dev). Use Ctrl+C to stop the session. See [headless development](/v2/guide/testing#headless-development) for display options.

## Inspect and verify changes

Ask the agent to inspect the running app before changing it, then verify the result after Fast Refresh updates the window. A useful sequence is:

1. Find a widget by its role, accessible name, or text with `gtkx_query_widgets`.
2. Read its properties or subtree when more context is needed.
3. Click, type, or press keys through the interaction tools.
4. Take a screenshot to check the rendered result.

The widget tools use the same queries and events as [`@gtkx/testing`](/v2/guide/testing). Each widget summary reports the widget's GTK type as `type` and its accessible name as `name`, so an icon-only button reads as its tooltip, such as "New Note". For large windows, request a subtree or limit the depth instead of repeatedly reading the whole tree. Widget IDs last only while their widgets are mounted; query again after the relevant UI is replaced.

`gtkx_press_keys` sends keys through `userEvent.keyboard` to a widget, which it focuses first when the widget can take focus or passes it to a child, as a `GtkMenuButton` does to its button, or to the focused widget when no `widgetId` is given. A widget that cannot take focus, such as the switch inside an `AdwSwitchRow`, leaves the window's focus where it is, so keys that neither it nor its ancestors take, such as `{Space}` and `{Enter}`, act on the focused widget instead; the result then says so and names the widget ID of its nearest ancestor that can take focus, here the row, to press the keys on. Use it to submit a form with `{Enter}`, which activates a dialog's default response from an entry with `activatesDefault`, to close a dialog with `{Escape}`, or to run a shortcut such as `{Control>}s{/Control}`. The keys reach the widget's own key bindings first, such as arrows in a list or `{Space}` on a color swatch in the dialog of a `GtkColorDialogButton`; otherwise `{Tab}`, `{Shift>}{Tab}{/Shift}` and arrows move focus between widgets as they do on a keyboard.

`gtkx_type` types into an editable widget the way `userEvent.type` does, so it replaces text that is already selected. GTK selects an entry's whole text when focus moves into it, as when a dialog opens with focus on its first entry, so typing there replaces the entry's text instead of appending to it. Pass `clear: true` with the full text to set a value.

A modifier that `gtkx_press_keys` presses without releasing, such as `{Control>}`, stays held for later calls, which is how an agent Control-clicks several rows. Its result names the modifiers left held and the keys that release them, such as `{/Control}`. While one is held, `gtkx_type` refuses with an error naming it, since every typed key would otherwise run as a shortcut, such as `{Control>}a` selecting all text, instead of entering text.

`gtkx_click` and `gtkx_press_keys` say in their result when nothing on the widget or its ancestors handled the input. A click counts as handled when it activated the widget, reached a click handler of the app, or reached a button, check button, menu item, row, tab or other widget whose click outcome `@gtkx/testing` applies. GTK's own pointer handling of other widgets, such as the swatches of a color dialog, needs a real pointer event, so the result tells the agent to press `{Space}` or `{Enter}` on the widget instead. A key counts as handled when a key binding, shortcut, accelerator or key handler took it, or it moved focus; the result names the keys that nothing took, such as text sent with `gtkx_press_keys` instead of `gtkx_type`. In tests, `userEvent` stays silent about unhandled input, as Testing Library does.

`gtkx_pointer` presses mouse buttons on a widget through `userEvent.pointer`, with the same tokens as in [tests](/v2/guide/testing#interacting-and-waiting). `[MouseRight]` right-clicks: it reaches the click gestures on the widget and its ancestors that listen for the secondary button, such as a `GtkGestureClick` with `button={Gdk.BUTTON_SECONDARY}` that opens a context menu. `[MouseMiddle]` does the same for the middle button, and `[MouseLeft]` clicks like `gtkx_click`. Append `>` to hold a button (`[MouseRight>]`) and prefix `/` to release it (`[/MouseRight]`). Each call takes one token in `input` and a `widgetId`.

An error the app raises while handling an interaction, such as a render error or an error a signal handler throws after a click, comes back in the tool result. `gtkx dev` also handles it as it does an error from keyboard or mouse input: it reports the error, ends the app and starts it again after a saved fix, as [Error Handling](/v2/guide/error-handling#uncaught-exceptions) describes. An error from using a tool on the wrong widget, such as typing into a button, comes back only in the tool result. `gtkx_click` refuses a widget a pointer cannot reach. When the widget sits inside one that cannot receive pointer input, such as the title of an `AdwTabOverview` thumbnail, the error gives the widget ID of the ancestor a pointer lands on, which the agent can click instead.

Several apps can share a server. All GTKX MCP servers of a session listen on one socket, so run one server, such as the root `.mcp.json` entry of a workspace: it lists and drives every running GTKX app, and a second server started next to it exits with an error. Its reference tools document the project it starts in; pass another app's directory as `projectRoot` for that app's bindings. Without `applicationId`, tools use the app from the server's project, or the first connected app when no app comes from it. Use `gtkx_list_apps` to find the others and pass `applicationId` to target one. The [Storybook explorer](/v2/guide/storybook) registers under the project's application ID with a `.Storybook` suffix, so `gtkx dev` and `gtkx storybook` can run together; tools without `applicationId` use the `gtkx dev` app. While that app is reconnecting, in the first seconds after the server starts or during a `gtkx dev` restart, they wait for it instead of answering from the explorer. If it does not come back, they use the explorer: after a few seconds when the server has just started, or after `appTimeout` (10 seconds by default) when the app disconnected. Widget requests wait briefly for an app that is still starting.

Your client exposes each tool's parameters and description. Screenshots can also be saved to a file, and `returnImage: false` avoids returning the image when only the saved file is needed.

## Look up generated bindings

The reference tools document the project's `@gtkx/gi/*` and `@gtkx/jsx/*` modules. They use the same GIR files as code generation and work without a running app.

Use `gtkx_search_api` to find a symbol or member, then `gtkx_get_api_docs` to read it. Search matches the names of classes, interfaces, records, enums, functions and constants, and of the constructors, static methods, properties, signals, methods and record fields of classes, interfaces and records, so `replaceContentsAsync` finds `Gio.File.replaceContentsAsync`. Results are ranked, exact names first, and limited to 20 unless you pass `limit`. Include the owner to list its members, such as `Gio.File.replace`, or the JSX element of a class, such as `GtkButton.icon`.

`gtkx_get_api_docs` accepts qualified names such as `Adw.Toast`, JSX names such as `AdwToast`, and member names such as `Gio.File.replaceContentsAsync`, `Gtk.Window.close-request` or `GtkWindow.close-request`, where a JSX element name stands for its class. A member name returns only that member's section, which is much shorter than a class page. A member a class inherits, such as `Gtk.Button.setVisible`, resolves to the ancestor that documents it. Pass `kind` when a signal and a method share a name. These are the same bindings covered by the [generated element reference](/v2/guide/configuration-and-codegen).

The server uses the project containing its working directory, falling back to a connected app's project. Pass `projectRoot` to select another project. Clients that browse MCP resources can access the reference there too. Projects with `codegen: false` have no generated bindings to document.

## Choose the available tools

Set `mcp.readOnly` to expose inspection and reference tools while leaving out app interactions. Use `mcp.tools` to select tools by name:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.app",
    mcp: {
        tools: ["gtkx_*", "!gtkx_take_screenshot"],
        readOnly: true,
    },
});
```

`*` matches any text, and a leading `!` removes matches. A list containing only exclusions starts with all tools. Otherwise, patterns add and remove tools in order, starting with none.

[Command-line options](/v2/guide/cli#gtkx-mcp) override the project settings for one client:

```bash
npx --no gtkx mcp --read-only --tools "gtkx_*_api,gtkx_get_widget_tree"
```
