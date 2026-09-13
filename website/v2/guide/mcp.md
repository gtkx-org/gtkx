---
title: "MCP"
description: "Inspect a running GTKX app and look up its generated bindings from your coding agent."
---

# MCP

`@gtkx/mcp` connects a coding agent to your running GTKX app. The agent can inspect widgets, interact with the window, take screenshots, and look up the exact bindings generated for your project.

## Setup

Install the server and the testing package that powers its widget tools. Scaffolded projects may already include them.

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

The command supports `claude`, `cursor`, `vscode`, `opencode`, and `codex`. It preserves existing server entries. For Codex, it prints configuration to add to your client instead of editing its settings. A scaffolded project already includes the Claude configuration.

For another MCP client, configure a stdio server that runs `npx gtkx mcp` from the project root. The standalone `gtkx-mcp` command is also available when `@gtkx/mcp` is installed directly.

Start the app in another terminal:

```bash
npx gtkx dev
```

The app connects automatically, and either side can start first. The connection is available during development; production builds exclude it.

For a session without a display, run `npx gtkx dev --headless`. Keep its launching terminal or supervisor running for the session: the app shuts down when that parent process exits. See [headless development](/v2/guide/testing#setup) for display options.

## Inspect and verify changes

Ask the agent to inspect the running app before changing it, then verify the result after Fast Refresh updates the window. A useful sequence is:

1. Find a widget by its role, accessible name, or text with `gtkx_query_widgets`.
2. Read its properties or subtree when more context is needed.
3. Click or type through the interaction tools.
4. Take a screenshot to check the rendered result.

The widget tools use the same queries and events as [`@gtkx/testing`](/v2/guide/testing). For large windows, request a subtree or limit the depth instead of repeatedly reading the whole tree. Widget IDs last only while their widgets are mounted; query again after the relevant UI is replaced.

Several apps can share a server. Use `gtkx_list_apps` to find them and pass `applicationId` to target one; otherwise, tools use the first connected app. Widget requests wait briefly for an app that is still starting.

Your client exposes each tool's parameters and description. Screenshots can also be saved to a file, and `returnImage: false` avoids returning the image when only the saved file is needed.

## Look up generated bindings

The reference tools document the project's `@gtkx/gi/*` and `@gtkx/jsx/*` modules. They use the same GIR files as code generation and work without a running app.

Use `gtkx_search_api` to find a symbol, then `gtkx_get_api_docs` to read its page. Qualified names such as `Adw.Toast` and JSX names such as `AdwToast` are accepted. These are the same bindings covered by the [generated element reference](/v2/guide/configuration-and-codegen).

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

Command-line flags override the project settings for one client:

```bash
npx gtkx mcp --read-only --tools "gtkx_*_api,gtkx_get_widget_tree"
```
