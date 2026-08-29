---
title: "MCP"
description: "Connect an AI coding agent to a running GTKX app for inspection, interaction, screenshots, and generated API lookup."
---

# MCP

The `@gtkx/mcp` server lets an MCP client inspect and drive an app running under `gtkx dev`. It also searches the exact API generated for the project's GIR libraries. Production builds include none of the server or app connection.

## Connect a client

Scaffolded projects already depend on `@gtkx/mcp`. Add it to an existing project, together with the testing package that backs widget interaction:

```bash
npm install -D @gtkx/mcp @gtkx/testing
```

Write the client configuration from the project root:

```bash
npx gtkx mcp init --client claude
```

The client can be `claude`, `cursor`, `vscode`, `opencode`, or `codex`. Existing servers are preserved. Codex stores servers outside the project, so the command prints the configuration to paste instead of editing it.

Start the application before asking the agent to inspect it:

```bash
npm run dev
```

`gtkx dev` connects the app automatically. Start order does not matter, and one server can see several running GTKX apps.

## Limit the tool surface

Register only the tools the client needs. `*` matches any characters, `!` excludes a pattern, and `readOnly` removes interaction tools:

```ts
export default defineConfig({
    applicationId: "com.example.app",
    mcp: {
        tools: ["gtkx_*", "!gtkx_take_screenshot"],
        readOnly: true,
    },
});
```

An all-exclusion list starts with every tool; a list containing an inclusion starts empty. Command-line flags override the project config for one client:

```bash
npx gtkx mcp --read-only --tools "gtkx_*_api,gtkx_get_widget_tree"
```

Use read-only mode for review and debugging. Enable interaction when the agent must verify a change by clicking, typing, or firing a signal.

## Inspect and drive the app

A reliable UI workflow is:

1. Call `gtkx_list_apps` to choose the application and window.
2. Call `gtkx_get_widget_tree` to see the visible hierarchy and widget IDs.
3. Narrow the result with `gtkx_query_widgets` by role, text, name, or label.
4. Read a candidate with `gtkx_get_widget_props` or capture the window with `gtkx_take_screenshot`.
5. Use `gtkx_click`, `gtkx_type`, or `gtkx_fire_event`, then inspect again to verify the result.

Pass `applicationId` when several apps are connected. Large trees can be explored a subtree at a time with `rootId` and `maxDepth`; prefer a query when you already know the accessible role or label.

The interaction tools use the same observable widget behavior as [`@gtkx/testing`](/reference/@gtkx/testing/). A click targets an accessible widget, typing targets an editable widget, and `gtkx_fire_event` is the escape hatch for a GTK signal without a higher-level action.

## Look up generated APIs

Use the reference tools before guessing a GTKX prop, signal, or method:

1. `gtkx_list_api` lists namespaces or the symbols in one namespace.
2. `gtkx_search_api` finds a symbol by name.
3. `gtkx_get_api_docs` returns the symbol's generated Markdown page.

The docs tool accepts qualified GI names such as `Gtk.Button`, JSX names such as `GtkButton`, and unambiguous bare names. Pass `projectRoot` when the server's working directory is not inside the project you want to search.

These are the same element pages produced by `gtkx docs` and described in [Configuration and Codegen](/guide/configuration-and-codegen#keep-coding-agent-context-current). MCP clients can also read them as `gtkx://reference/index`, `gtkx://reference/{namespace}`, and `gtkx://reference/{namespace}/{symbol}` resources.

Every registered tool carries its input schema and description, so the MCP client's tool inspector is the reference for complete arguments. Run `npx gtkx mcp --help` for server flags.

## Next

- [Deploying](/guide/deploying) packages the app for Flatpak, deb, rpm, and AppImage.
- The [API reference](/reference/) documents GTKX packages and generated bindings.
- The [testing tutorial](/tutorial/testing) applies the same queries and events in automated tests.
