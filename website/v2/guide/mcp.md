---
title: "App Inspection (MCP)"
description: "Inspect a running GTKX app and look up its generated bindings from your coding agent."
---

# App Inspection (MCP)

`@gtkx/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io/docs/learn/server-concepts) server that connects a coding agent to your running GTKX app. The agent can inspect widgets, interact with the window, take screenshots, and look up the exact bindings generated for your project.

## Setup

Install the server and the testing package its widget tools use. Scaffolded projects include both.

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

From the project root, register the server with your client. A scaffolded project already has the Claude configuration.

```bash
npx gtkx mcp init --client claude
```

[`--client`](/v2/guide/cli#gtkx-mcp-init) accepts `claude`, `cursor`, `vscode`, `opencode`, and `codex`. The command adds a `gtkx` entry to the client's project configuration file, replacing an older one and keeping the file's other entries and indentation. When it cannot edit the file safely, such as a JSON file with comments or a Codex file that already declares `gtkx` as an inline table, it leaves the file unchanged and prints the entry to add. For Codex it writes a `[mcp_servers.gtkx]` table to `.codex/config.toml`, which Codex reads only in a [trusted project](https://developers.openai.com/codex/mcp).

### Other clients

Configure a stdio server that runs `npx --no gtkx mcp`. Clients start servers without a terminal, where plain `npx` would install and run an unrelated `gtkx` package from the npm registry when `@gtkx/cli` is missing; `--no` makes it fail instead. The standalone `gtkx-mcp` command is also available when `@gtkx/mcp` is installed directly.

Start the server in the app's directory. It reads the configuration and generated bindings of the directory it starts in, and pnpm installs the CLI only in the app, not at a workspace root. The first app scaffolded into a workspace adds an entry to the root's `.mcp.json` that does this through the package manager, such as `pnpm --dir apps/my-app exec gtkx mcp`; see [Scaffold Options](/v2/guide/scaffold-options#workspaces).

### Start the app

```bash
npx gtkx dev
```

The app connects automatically, and either side can start first. The connection exists only during development; production builds exclude it. For a session without a display, run [`npx gtkx dev --headless`](/v2/guide/cli#gtkx-dev) and stop it with Ctrl+C. See [headless development](/v2/guide/testing#headless-development) for display options.

## Inspect and verify changes

Ask the agent to inspect the running app before changing it, then verify the result after Fast Refresh updates the window. A useful sequence is:

1. Find a widget by its role, accessible name, or text with `gtkx_query_widgets`.
2. Read its properties or subtree when more context is needed.
3. Click, type, or press keys through the interaction tools.
4. Take a screenshot to check the rendered result.

A screenshot shows the window at the moment it is taken, so one taken straight after a click can catch a transition half done, such as a stack crossfading between pages. Take another once the animation has finished.

### Tools

| Tool                    | Read-only | Use                                                                    |
| ----------------------- | --------- | ---------------------------------------------------------------------- |
| `gtkx_list_apps`        | Yes       | List the connected apps and their windows                              |
| `gtkx_query_widgets`    | Yes       | Find widgets by role, text, accessible name or label                   |
| `gtkx_get_widget_tree`  | Yes       | Read the widget tree, or one subtree, to a chosen depth                |
| `gtkx_get_widget_props` | Yes       | Read a widget's state and the GObject properties you ask for           |
| `gtkx_take_screenshot`  | Yes       | Capture a window as an image, a saved PNG, or both                     |
| `gtkx_click`            | No        | Click a widget                                                         |
| `gtkx_type`             | No        | Type text into an editable widget                                      |
| `gtkx_press_keys`       | No        | Press keys and shortcuts, such as `{Enter}` or `{Control>}s{/Control}` |
| `gtkx_pointer`          | No        | Press, hold or release a mouse button on a widget                      |
| `gtkx_fire_event`       | No        | Emit a GObject signal on a widget                                      |
| `gtkx_list_api`         | Yes       | List the namespaces and symbols of the generated bindings              |
| `gtkx_search_api`       | Yes       | Search the generated bindings by name                                  |
| `gtkx_get_api_docs`     | Yes       | Read the reference for one symbol or member                            |

Your client shows the agent each tool's parameters and description. Widget summaries report the GTK type as `type` and the accessible name as `name`, so an icon-only button reads as its tooltip. For a large window, request a subtree or limit the depth rather than reading the whole tree again. Widget IDs last only while their widgets are mounted, so query again after the UI they belong to is replaced.

### Simulated input

The interaction tools use the same queries and `userEvent` helpers as [`@gtkx/testing`](/v2/guide/testing#interacting-and-waiting), not a real keyboard or mouse. In practice:

- `gtkx_type` replaces selected text, as typing does. GTK selects an entry's text when focus moves into it, as when a dialog opens, so the agent passes `clear: true` with the full text to set a value.
- `gtkx_press_keys` focuses the widget first when it can take focus. A widget that cannot, such as the switch inside an `AdwSwitchRow`, leaves the focus where it is, and the result names the ancestor to press the keys on instead.
- A modifier pressed without release, such as `{Control>}`, stays held for later calls until `{/Control}`, which is how an agent Control-clicks several rows. `gtkx_type` refuses while one is held.
- `gtkx_pointer` takes one token, such as `[MouseRight]` for a right click that opens a context menu, `[MouseRight>]` to hold the button and `[/MouseRight]` to release it.
- `gtkx_click` and `gtkx_press_keys` say in their result when nothing on the widget or its ancestors handled the input. Some GTK widgets, such as the swatches of a color dialog, react only to a real pointer event, so the result suggests pressing `{Space}` or `{Enter}` on them instead. In tests, `userEvent` stays silent about unhandled input, as Testing Library does.

### Errors

An error the app raises while handling an interaction, such as a render error or an exception from a signal handler, comes back in the tool result. `gtkx dev` also handles it as it does any uncaught error: it ends the app and starts it again after a saved fix, as [Error Handling](/v2/guide/error-handling#uncaught-exceptions) describes. An error from using a tool on the wrong widget, such as typing into a button or clicking one behind an open dialog, comes back only in the tool result, which names what blocks it or the widget to target instead.

### Several apps

All GTKX MCP servers of a session listen on one socket, so run one server: it lists and drives every running GTKX app, and a second server started next to it exits with an error. Without `applicationId`, tools use the app from the server's project, or the first connected app when none comes from it. Use `gtkx_list_apps` to find the others and pass `applicationId` to target one.

The [Storybook explorer](/v2/guide/storybook) registers under the project's application ID with a `.Storybook` suffix, so `gtkx dev` and `gtkx storybook` can run together. Tools without `applicationId` use the `gtkx dev` app. While it restarts, they wait for it, up to `appTimeout` (10 seconds by default), before falling back to the explorer.

## Look up generated bindings

The reference tools document the project's `@gtkx/gi/*` and `@gtkx/jsx/*` modules. They use the same GIR files as code generation and work without a running app.

Use `gtkx_search_api` to find a symbol or member, then `gtkx_get_api_docs` to read it. Search matches the names of symbols and of their members, so `replaceContentsAsync` finds `Gio.File.replaceContentsAsync`. Results are ranked with exact names first and limited to 20 unless you pass `limit`. Include the owner to list its members, such as `Gio.File.replace`, or a JSX element's props, such as `GtkButton.icon`.

`gtkx_get_api_docs` accepts qualified names such as `Adw.Toast`, JSX names such as `AdwToast`, and member names such as `Gio.File.replaceContentsAsync` or `GtkWindow.close-request`. A member name returns only that member's section, which is much shorter than a class page, and an inherited member such as `Gtk.Button.setVisible` resolves to the ancestor that documents it. Pass `kind` when a signal and a method share a name. [`gtkx docs`](/v2/guide/configuration-and-codegen#generating-element-reference-docs) writes static reference pages from the same bindings.

The server documents the project containing its working directory, falling back to a connected app's project. Pass `projectRoot` to select another project. Clients that browse MCP resources can read the reference there too. A project with `codegen: false` has no generated bindings to document.

## Point the agent to the guide

The server documents the generated bindings, not how to build a GTKX app. For that, give the agent this version's guide and tutorial as Markdown: [https://gtkx.dev/v2/llms.txt](https://gtkx.dev/v2/llms.txt) lists every page, and [https://gtkx.dev/v2/llms-full.txt](https://gtkx.dev/v2/llms-full.txt) holds all of their text in one large file. Each page also has a Markdown copy at its own URL with `.md` added, such as [https://gtkx.dev/v2/guide/mcp.md](https://gtkx.dev/v2/guide/mcp.md). See [Machine-readable documentation](/versions#machine-readable-documentation) for the other versions.

## Choose the available tools

Set `mcp.readOnly` to expose only the read-only tools, leaving out app interactions. Use `mcp.tools` to select tools by name:

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
