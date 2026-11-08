---
description: "Let an AI coding agent inspect and drive the running app through the GTKX MCP server."
---

# Inspect with MCP

Connect an AI coding agent to the running app through the GTKX MCP server, and let it inspect the widget tree and take screenshots.

An agent that edits the app's code sees only the source, not the window it produces. The GTKX MCP server, a [Model Context Protocol](https://modelcontextprotocol.io/docs/learn/server-concepts) server, connects the agent to the app that `npm run dev` runs: it finds widgets, reads their state, clicks and types, and captures the window. [App Inspection (MCP)](/v2/guide/mcp) covers it in full.

## Connect an agent

The scaffold registered the server for Claude Code in `.mcp.json` at the project root:

<<< @/figures/tutorial/mcp/.mcp.json [.mcp.json]

The entry runs the project's own `gtkx mcp` command. `--no` makes `npx` fail instead of downloading an unrelated `gtkx` package if the CLI is missing.

Start Claude Code in the project directory. It [asks you to approve](https://code.claude.com/docs/en/mcp#project-scope) a server from `.mcp.json` before using it. For another agent, run `npx gtkx mcp init --client <client>` or configure the server by hand; see [Setup](/v2/guide/mcp#setup).

## Inspect the window

With `npm run dev` running, the app connects to the server on its own, and either can start first. Ask the agent about the window, such as which notes the list shows.

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

`type` is the GTK class and `name` the accessible name, the same name the tests in [Test the App](/v2/tutorial/testing) find widgets by. The agent passes the `id` to later calls, such as `gtkx_click`, while the widget stays mounted. See [Tools](/v2/guide/mcp#tools) for the full list.

## Run it

Ask the agent to open Book club, turn on the preview and take a screenshot. It clicks the row, then the toggle button whose accessible name is its tooltip, "Preview (Ctrl+Shift+P)". The screenshot shows Book club rendered with its #home and #reading tags, as the window does.

Then ask for a change, such as a different style for the tags. The agent edits the code, Fast Refresh applies it to the open window, and the agent takes another screenshot to check the result; see [Inspect and verify changes](/v2/guide/mcp#inspect-and-verify-changes).
