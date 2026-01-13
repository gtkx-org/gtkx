# MCP Integration

GTKX provides an MCP (Model Context Protocol) server that enables AI assistants to interact with your running GTK applications.

## Overview

The `@gtkx/mcp` package exposes your application's widget tree and provides tools for AI-powered testing, debugging, and automation. When you run your app with `gtkx dev`, it automatically connects to the MCP server, allowing AI assistants like Claude to inspect and interact with your UI.

## Setup

### Claude Desktop Configuration

Add the MCP server to your Claude Desktop configuration (`~/.config/claude/claude_desktop_config.json`):

```json
{
 "mcpServers": {
 "gtkx": {
 "command": "npx",
 "args": ["-y", "@gtkx/mcp@latest"]
 }
 }
}
```

### Running Your App

Start your application with the dev server:

```bash
npx gtkx dev src/dev.tsx
```

The dev server automatically connects to the MCP server when available. You'll see connection messages in the console:

```
[gtkx] Connected to MCP server at /run/user/1000/gtkx-mcp.sock
```

The socket path uses `$XDG_RUNTIME_DIR` when available, falling back to `/tmp`.

## Available Tools

The MCP server provides the following tools for AI assistants:

### `gtkx_list_apps`

List all connected GTKX applications.

**Parameters:** None

**Returns:** Array of connected apps with their IDs and PIDs.

### `gtkx_get_widget_tree`

Get the complete widget hierarchy for a connected app.

| Parameter | Type | Required | Description |
| --------- | ------ | -------- | ----------------------------------------------------------- |
| `appId` | string | No | App ID to query. Uses first connected app if not specified. |

**Returns:** Tree structure with all widgets, their IDs, types, roles, and properties.

### `gtkx_query_widgets`

Find widgets by role, text, testId, or label text.

| Parameter | Type | Required | Description |
| ----------------- | ---------------- | -------- | ------------------------------------------------------------ |
| `appId` | string | No | App ID to query |
| `by` | string | Yes | Query type: `"role"`, `"text"`, `"testId"`, or `"labelText"` |
| `value` | string \| number | Yes | Value to search for |
| `options.name` | string | No | Widget name filter |
| `options.exact` | boolean | No | Require exact match |
| `options.timeout` | number | No | Query timeout in ms |

**Returns:** Array of matching widgets with their properties.

### `gtkx_get_widget_props`

Get all properties of a specific widget.

| Parameter | Type | Required | Description |
| ---------- | ------ | -------- | -------------------- |
| `appId` | string | No | App ID to query |
| `widgetId` | string | Yes | Widget ID to inspect |

**Returns:** Widget properties including type, role, text, sensitivity, visibility, and CSS classes.

### `gtkx_click`

Click a widget. Works with buttons, checkboxes, and other interactive widgets.

| Parameter | Type | Required | Description |
| ---------- | ------ | -------- | ------------------ |
| `appId` | string | No | App ID to query |
| `widgetId` | string | Yes | Widget ID to click |

### `gtkx_type`

Type text into an editable widget like Entry or TextView.

| Parameter | Type | Required | Description |
| ---------- | ------- | -------- | --------------------------------- |
| `appId` | string | No | App ID to query |
| `widgetId` | string | Yes | Widget ID to type into |
| `text` | string | Yes | Text to type |
| `clear` | boolean | No | Clear existing text before typing |

### `gtkx_fire_event`

Emit a GTK signal on a widget for custom interactions.

| Parameter | Type | Required | Description |
| ---------- | ------ | -------- | ------------------------------------------------- |
| `appId` | string | No | App ID to query |
| `widgetId` | string | Yes | Widget ID to emit event on |
| `signal` | string | Yes | GTK signal name (e.g., `"activate"`, `"clicked"`) |
| `args` | array | No | Arguments to pass to the signal |

### `gtkx_take_screenshot`

Capture a screenshot of a window.

| Parameter | Type | Required | Description |
| ---------- | ------ | -------- | --------------------------------------------------------- |
| `appId` | string | No | App ID to query |
| `windowId` | string | No | Window ID to capture. Uses first window if not specified. |

**Returns:** Base64-encoded PNG image data.

## Widget Serialization

Widgets are serialized with the following properties:

```typescript
interface SerializedWidget {
 id: string;
 type: string;
 role: string;
 name: string | null;
 label: string | null;
 text: string | null;
 sensitive: boolean;
 visible: boolean;
 cssClasses: string[];
 children: SerializedWidget[];
 bounds?: {
 x: number;
 y: number;
 width: number;
 height: number;
 };
}
```

## Use Cases

### AI-Assisted Testing

Ask your AI assistant to interact with your running app:

> "Click the 'Add Task' button, type 'Buy groceries' in the input field, then press Enter"

### Debugging UI State

Inspect the current widget tree:

> "Show me the widget tree and find all buttons that are currently disabled"

### Automated Workflows

Create complex interaction sequences:

> "Fill out the login form with test credentials and submit it"

## Architecture

```
┌─────────────────┐ stdio ┌──────────────┐
│ AI Assistant │◀──────────────▶│ gtkx-mcp │
│ (e.g. Claude) │ │ server │
└─────────────────┘ └──────┬───────┘
 │ Unix socket
 │ $XDG_RUNTIME_DIR/gtkx-mcp.sock
 ▼
 ┌──────────────┐
 │ gtkx dev │
 │ (MCP client)│
 └──────┬───────┘
 │
 ▼
 ┌──────────────┐
 │ GTK4 App │
 └──────────────┘
```

The MCP server communicates with AI assistants via stdio and with your running app via a Unix socket. This allows the AI to inspect and interact with native GTK widgets in real-time.
