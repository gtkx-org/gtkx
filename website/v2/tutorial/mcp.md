---
description: "Let an AI coding agent inspect and drive the running app through the GTKX MCP server."
---

# Inspect with MCP

Connect an AI coding agent to the running app through the GTKX MCP server, and let it inspect the widget tree and take screenshots.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Connect an agent

The scaffold registered the server for Claude Code in `.mcp.json` at the project root:

<<< @/figures/tutorial/mcp/.mcp.json [.mcp.json]

Start Claude Code in the project directory. It [asks you to approve](https://code.claude.com/docs/en/mcp#project-scope) a server from `.mcp.json` before using it. For another agent, run `npx gtkx mcp init --client <client>` or configure the server by hand; see [MCP setup](/v2/guide/mcp#setup).

## Inspect the window

Start the app with `npm run dev`. It connects to the server on its own, and either can start first. Then ask the agent about the window, such as which notes the list shows.

The agent finds widgets by role, accessible name or text with `gtkx_query_widgets`, reads their properties with `gtkx_get_widget_props`, and captures the window with `gtkx_take_screenshot`. Searching the text for Book club returns the title label of its row:

```json
{
  "widgets": [
    {
      "id": "68",
      "type": "Label",
      "role": "label",
      "name": "Book club",
      "text": "Book club",
      "isSensitive": true,
      "isVisible": true,
      "cssClasses": ["heading"],
      "children": []
    }
  ],
  "searched": "the text the widget renders"
}
```

The agent passes the `id` to later calls, such as `gtkx_click`, while the widget stays mounted. See [Tools](/v2/guide/mcp#tools) for the full list.

## Run it

Ask the agent to open Book club, turn on the preview and take a screenshot. It clicks the row, then the toggle button whose accessible name is its tooltip, "Preview (Ctrl+Shift+P)". The screenshot shows Book club rendered with its #home and #reading tags, as the window does.
