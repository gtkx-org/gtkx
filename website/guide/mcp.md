---
title: "MCP"
description: "Give AI coding agents eyes and hands on your running app: the @gtkx/mcp server exposes the widget tree, queries, clicks, typing, screenshots, and a searchable API reference for your generated bindings over the Model Context Protocol."
---

# MCP

`@gtkx/mcp` is a stdio MCP (Model Context Protocol) server that connects any MCP client, Claude Code or otherwise, to a running GTKX app. Through it an agent inspects and drives the live window, and looks up the exact props, signals, and method signatures of the project's generated bindings instead of guessing. Combined with the Fast Refresh loop of `gtkx dev`, that gives an agent the same edit, look, verify cycle you have.

`gtkx dev` starts the app side automatically as soon as the entry module mounts an application, and the two halves find each other whenever both are up, so start order does not matter. Several apps can register with one server: every tool that targets a running app takes an optional `applicationId` and defaults to the first connected app, while the reference tools take `projectRoot` instead. All of this is development tooling, so `gtkx build` bundles none of it and a production app has nothing listening.

## Setup

Two packages belong in the project's dev dependencies. `@gtkx/mcp` carries the `gtkx-mcp` binary the MCP client launches, and `@gtkx/testing` backs every widget tool. A scaffolded project already depends on `@gtkx/mcp`, and one scaffolded with the testing option has `@gtkx/testing` too. Otherwise install them:

::: code-group

```bash [npm]
npm install -D @gtkx/mcp @gtkx/testing
```

```bash [pnpm]
pnpm add -D @gtkx/mcp @gtkx/testing
```

```bash [yarn]
yarn add -D @gtkx/mcp @gtkx/testing
```

:::

`@gtkx/mcp` has to be a direct dev dependency. Under pnpm, the nested copy `@gtkx/cli` pulls in stays in the virtual store, and the launch below fails with `gtkx-mcp: command not found`.

Register `gtkx-mcp` as a stdio server, launched from the project root. For Claude Code:

```bash
claude mcp add gtkx -- npx -y @gtkx/mcp
```

For any other MCP client, the standard `mcpServers` configuration looks like this:

```json
{
    "mcpServers": {
        "gtkx": {
            "command": "npx",
            "args": ["-y", "@gtkx/mcp"]
        }
    }
}
```

To try the server against a project without adding the dependency, run `pnpm dlx @gtkx/mcp`, which installs the latest published release rather than the one matching the project.

The widget tools fail until an app is running under `gtkx dev`.

## The tools

| Tool | Kind | What it does |
|---|---|---|
| `gtkx_list_apps` | Inspection | List connected apps and their open windows |
| `gtkx_get_widget_tree` | Inspection | Dump an app's widget hierarchy with IDs |
| `gtkx_query_widgets` | Inspection | Find widgets by role, text, name, or label |
| `gtkx_get_widget_props` | Inspection | Read one widget's summary, GObject properties, and bounded subtree |
| `gtkx_take_screenshot` | Inspection | Capture a window as a PNG |
| `gtkx_click` | Interaction | Click a widget |
| `gtkx_type` | Interaction | Type into an editable widget |
| `gtkx_fire_event` | Interaction | Emit an arbitrary GTK4 signal |
| `gtkx_list_api` | Reference | List the bindings' namespaces, or one namespace's symbols |
| `gtkx_search_api` | Reference | Search the bindings' symbols by name |
| `gtkx_get_api_docs` | Reference | Get the full reference page for one symbol |

### Inspection

**`gtkx_list_apps`** lists every connected app with its application ID, process ID, and open windows (each with an ID and title). Pass `waitForApps: true` to block until at least one app registers, with `timeout` in milliseconds (default 10000).

**`gtkx_get_widget_tree`** returns an app's widget hierarchy as an indented, HTML-like tree. `rootId` renders only the subtree under one widget ID and `maxDepth` caps how deep the tree goes (`0` renders the root on its own), summarizing each cut-off widget's children as a count with the ID to pass as `rootId`. The output is truncated at 7000 characters; raise that by starting the app with `DEBUG_PRINT_LIMIT=50000 gtkx dev`.

```html
<Window id="0" name="GtkWindow" role="window">
  <Box id="1" name="GtkBox" role="generic">
    <Label id="2" name="GtkLabel" role="label">
      Groceries
    </Label>
    <Entry id="3" name="GtkEntry" role="text_box">
      <Text id="4" name="GtkText" role="none">
    </Entry>
    <Button id="6" name="GtkButton" role="button">
      New List
    </Button>
  </Box>
</Window>
```

**`gtkx_query_widgets`** finds widgets without dumping the whole tree. It takes `by` (one of `"role"`, `"text"`, `"name"`, `"labelText"`), a `value` to match, and an `options` object with `exact`, `timeout`, and `name` (an accessible-name filter, honored only for role queries). Role values are `Gtk.AccessibleRole` member names:

```json
{
    "by": "role",
    "value": "BUTTON",
    "options": { "name": "New List" }
}
```

Each match comes back with its ID and the same summary `gtkx_get_widget_props` returns, with no descendants: a match that has children carries `hiddenChildren`, the count of its direct children left out. The widget tools run through [`@gtkx/testing`](/guide/testing), so these queries match `findAllByRole`, `findAllByText`, `findAllByName`, and `findAllByLabelText` exactly, and anything learned about querying in tests transfers directly.

**`gtkx_get_widget_props`** takes a `widgetId` and returns a fixed summary of that widget (type, accessible role, name, text, sensitivity, visibility, and CSS classes) followed by the same summary for a subtree of descendants bounded twice: eight levels deep, which `maxDepth` raises or lowers (`0` returns the widget on its own), and thirty widgets in all whatever the depth. Any widget whose own direct children were left out carries `hiddenChildren`, their count, so drilling in is one more call with that widget's ID. Pass `properties` with GObject property names, kebab-case or camelCase, to read named properties as well.

**`gtkx_take_screenshot`** captures a window and returns it as base64 PNG image content. `windowId` selects a window (defaulting to the first), and an optional absolute `path` also writes the PNG to disk on the app's machine.

Widget IDs stay stable for as long as a widget is mounted and stop resolving once it unmounts, so after a dialog closes, a list re-renders, or Fast Refresh patches a component, re-fetch the tree or re-query rather than reusing stale IDs.

### Interaction

Every widget tool call is routed to the app with a 30 second timeout, so a hung app surfaces as a tool error rather than a stuck agent.

**`gtkx_click`** clicks the widget with the given `widgetId`, and works on any activatable widget.

**`gtkx_type`** types `text` into an editable widget such as a `GtkEntry` or `GtkTextView`. Pass `clear: true` to empty the widget first.

**`gtkx_fire_event`** emits an arbitrary GTK4 `signal` on a widget, with an optional `args` array, for interactions the other two do not cover: `close-request` on a window, or a custom signal the code connects to.

### API reference

The reference tools answer from the same GObject-Introspection data the bindings are generated from, so they document exactly what a project's generated bindings export. They need no running app, but a project with `codegen: false` has no bindings to document. All three take an optional `projectRoot`.

**`gtkx_list_api`** without arguments returns an overview of every namespace the configured libraries pull in, with symbol and JSX element counts. With a `namespace` it lists that namespace's symbols grouped by kind.

**`gtkx_search_api`** finds symbols by a case-insensitive substring of their name, with optional `namespace`, `kind`, and `limit` filters.

**`gtkx_get_api_docs`** returns one symbol's full reference page as markdown. It accepts a qualified name (`Gtk.Button`, `GLib.Variant`), a JSX element name (`GtkButton`), or a bare name when it is unambiguous, and a `kind` parameter disambiguates when several symbols share a name. Element pages match the ones `gtkx docs` generates (see [generating element reference docs](/guide/configuration-and-codegen#generating-element-reference-docs)).

Pass `projectRoot`, any directory inside the project, absolute or relative, to choose which project the answers cover. Without it, the server documents the project containing its working directory, falling back to a connected app's project root when that directory is not inside a GTKX project. The same pages are published as MCP resources for clients that work resource-first: `gtkx://reference/index` is the overview, `gtkx://reference/{namespace}` one namespace's symbol list, and `gtkx://reference/{namespace}/{symbol}` one symbol's page.

## Next

- The [API reference](/reference/) documents the GTKX packages themselves.
- The [tutorial's testing chapter](/tutorial/testing) applies the queries and events behind these tools to the Tasks app.
