---
title: "MCP"
description: "Let a coding agent inspect and drive a running GTKX app."
---

# MCP

`@gtkx/mcp` exposes applications running under `gtkx dev`, plus the exact API reference generated for the project. It is excluded from production builds.

## Connect a client

```bash
npm install -D @gtkx/mcp @gtkx/testing
npx gtkx mcp init --client codex
npm run dev
```

The initializer also supports Claude, Cursor, VS Code, and OpenCode. It preserves existing servers; for clients with global configuration it prints the entry to paste.

Use `mcp.readOnly: true` for inspection. `mcp.tools` accepts inclusion globs and `!` exclusions when a client needs a smaller surface. Command-line flags override project settings; `npx gtkx mcp --help` is the complete flag reference.

## Inspect and verify

1. List connected applications and select a window.
2. Read or query its accessible widget tree.
3. Inspect a widget or capture a screenshot.
4. Click, type, or fire a signal when interaction is enabled.
5. inspect again to verify the result.

Pass the application ID when several apps are connected. Query by role, name, text, or label instead of repeatedly loading a large tree. Interaction follows the same observable behavior as [`@gtkx/testing`](/guide/testing).

## Look up generated APIs

The API tools list namespaces, search symbols, and return generated Markdown for GI or JSX names. Use them before guessing a prop, signal, or method. Pass the project root when the server is not running inside the target project.

Tool schemas in the MCP client are the argument reference. The same pages are available under `.gtkx/reference` and through `gtkx docs`; see [Configuration and Codegen](/guide/configuration-and-codegen).
