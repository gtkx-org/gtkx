---
description: "Give AI coding agents eyes and hands on your running app: the @gtkx/mcp server exposes the widget tree, queries, clicks, typing, screenshots, and a searchable API reference for your generated bindings over the Model Context Protocol."
---

# MCP

An AI coding agent working on a web app can open the page and read the DOM. A native GTK window gives it nothing: no HTML to parse, no DevTools to attach. `@gtkx/mcp` closes that gap. It is an MCP (Model Context Protocol) server that connects any MCP client, Claude Code or otherwise, to your live GTKX app. Through it, an agent can list open windows, dump the widget tree, find widgets the way a test would, click buttons, type into entries, emit signals, and screenshot the result. It also serves a searchable API reference for your project's generated bindings, so the agent can look up the exact props, signals, and method signatures it is coding against instead of guessing at them. Combined with the Fast Refresh loop of `gtkx dev`, this gives an agent the same edit, look, verify cycle you have as a human developer.

## How it connects

The system has two halves that find each other through a Unix domain socket.

The **server half** is the `gtkx-mcp` binary from the `@gtkx/mcp` package. Your MCP client launches it as an ordinary stdio MCP server. On startup it also opens a socket at `$XDG_RUNTIME_DIR/gtkx-mcp.sock` (falling back to the system temporary directory) and waits for apps to register. Because the socket path is fixed, one server serves your whole session; a second instance refuses to start while the first is alive.

The **app half** lives inside `gtkx dev`. When your entry module mounts an application, the dev runner starts an MCP client in the app process that connects to that same socket and registers with the app's application ID, process ID, and project root. If the server is not running yet, the client silently retries every two seconds, so the order never matters: start the agent first or the app first, and they connect whenever both are up. Several apps can register with one server at the same time; every tool except `gtkx_list_apps` accepts an optional `applicationId` and defaults to the first connected app.

Interactions are not reimplemented for MCP. Clicking, typing, querying, and screenshots all delegate to [`@gtkx/testing`](/guide/testing), loaded through your app's own module graph: `gtkx_click` runs `userEvent.click`, `gtkx_query_widgets` runs the `findAllBy*` queries, and the widget tree is rendered by `prettyWidget`. That means `@gtkx/testing` must be in your dev dependencies for every widget tool to work (of the app-facing tools, only `gtkx_list_apps` gets by without it; the API reference tools never touch the app). Projects scaffolded with the testing option already have it; otherwise install it:

```bash
npm install -D @gtkx/testing
```

All of this is development tooling. The MCP client is part of the CLI's dev runner, not your application code, so `gtkx build` bundles none of it and a production app has nothing listening.

## Setup

On the app side there is nothing to enable: `gtkx dev` starts the client automatically whenever your entry mounts an application. On the agent side, register `gtkx-mcp` as a stdio server. For Claude Code:

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

The binary takes no arguments and has no configuration of its own; there is nothing else to set up. If the agent calls a tool before any app has connected, the error is self-explanatory: "No GTKX application connected: start an app with 'gtkx dev' to connect".

## The tools

The server exposes eleven tools: five for inspection, three for interaction, and three for the API reference:

| Tool | Kind | What it does |
|---|---|---|
| `gtkx_list_apps` | Inspection | List connected apps and their open windows |
| `gtkx_get_widget_tree` | Inspection | Dump an app's widget hierarchy with IDs |
| `gtkx_query_widgets` | Inspection | Find widgets by role, text, name, or label |
| `gtkx_get_widget_props` | Inspection | Read one widget's serialized properties |
| `gtkx_take_screenshot` | Inspection | Capture a window as a PNG |
| `gtkx_click` | Interaction | Click a widget |
| `gtkx_type` | Interaction | Type into an editable widget |
| `gtkx_fire_event` | Interaction | Emit an arbitrary GTK signal |
| `gtkx_list_api` | Reference | List the bindings' namespaces, or one namespace's symbols |
| `gtkx_search_api` | Reference | Search the bindings' symbols by name |
| `gtkx_get_api_docs` | Reference | Get the full reference page for one symbol |

### Inspection

The five read-only tools carry the MCP `readOnlyHint` annotation, so clients that gate destructive actions can run them freely.

**`gtkx_list_apps`** lists every connected app with its application ID, process ID, and open windows (each with an ID and title). Pass `waitForApps: true` to block until at least one app registers, with `timeout` in milliseconds (default 10000). This is the natural first call in any session, especially right after launching `gtkx dev`, when the app may still be starting.

**`gtkx_get_widget_tree`** returns the full widget hierarchy of an app as an indented, HTML-like tree: each widget appears as a tag named after its class, with its `id`, widget `name`, and accessible `role` as attributes, its text content nested inside, and `accessible-disabled` or `accessible-hidden` flags when a widget is insensitive or invisible. An excerpt looks like this:

```
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

This is the map the agent navigates by, and the source of the widget IDs every other tool consumes.

**`gtkx_query_widgets`** finds widgets the way a test does, without dumping the whole tree. It takes `by` (one of `"role"`, `"text"`, `"name"`, `"labelText"`), a `value` to match, and an `options` object with `name` (filter by accessible name), `exact` (exact versus substring matching), and `timeout`. Role values are the `Gtk.AccessibleRole` member names:

```json
{
    "by": "role",
    "value": "BUTTON",
    "options": { "name": "New List" }
}
```

That call finds every button whose accessible name is "New List" and returns each match with its ID and serialized properties. These are the same queries as `findAllByRole`, `findAllByText`, `findAllByName`, and `findAllByLabelText` in `@gtkx/testing`, with the same matching semantics, so anything you have learned about querying in tests transfers directly.

**`gtkx_get_widget_props`** takes a `widgetId` and returns that widget's serialized state: `id`, `type`, `role`, `name`, `text`, `sensitive`, `visible`, `cssClasses`, and `children`. Use it to check a single widget without re-fetching the tree, for example to confirm a button became insensitive or a row picked up a CSS class.

**`gtkx_take_screenshot`** captures a window and returns it as base64 PNG image content. `windowId` selects a window (defaulting to the first), and an optional absolute `path` also writes the PNG to disk on the app's machine, creating directories as needed, which is how agents save screenshots into a repository for documentation or visual comparison. A screenshot shows results but cannot be clicked; widget IDs for interaction always come from the tree or a query.

Widget IDs are stable for as long as a widget stays mounted: the app re-walks its toplevel windows on every request and each widget keeps the same ID for its lifetime. An ID stops resolving once its widget is unmounted, so after a dialog closes, a list re-renders, or Fast Refresh replaces a component, the agent re-fetches the tree or re-queries instead of reusing stale IDs.

### Interaction

The three mutating tools carry the `destructiveHint` annotation, so clients that ask for confirmation before mutations will do so here.

**`gtkx_click`** clicks the widget with the given `widgetId`. It works on anything `userEvent.click` handles: buttons, check buttons, switches, rows, and other activatable widgets.

**`gtkx_type`** types `text` into an editable widget such as a `GtkEntry` or `GtkTextView`. Pass `clear: true` to empty the widget first, which is how you replace a value instead of appending to it.

**`gtkx_fire_event`** emits an arbitrary GTK `signal` on a widget, with an optional `args` array, for interactions the higher-level tools do not cover: emitting `close-request` on a window, or a custom signal your code connects to. Each argument can be a raw value or a `{ type, value }` object, in which case the `value` is passed through.

::: info
Every widget tool call, inspection or interaction, is routed to the app with a 30 second timeout, so a hung app surfaces as a tool error rather than a stuck agent.
:::

### API reference

The three reference tools answer from the same GObject-Introspection data your bindings are generated from, so what they document is exactly what `@gtkx/gi` and `@gtkx/jsx` export: the same camelCase methods, the same promisified async pairs, the same JSX props and `on<Signal>` handlers. They need no running app and no `@gtkx/testing`; the only requirement is a project with codegen enabled, since a `codegen: false` project has no generated bindings to document. All three are read-only.

**`gtkx_list_api`** without arguments returns an overview of every namespace the configured libraries pull in, with symbol and JSX element counts. With a `namespace` it lists all of that namespace's symbols grouped by kind: JSX elements, classes, interfaces, records, enums, callbacks, aliases, functions, and constants.

**`gtkx_search_api`** finds symbols by a case-insensitive substring of their name, with optional `namespace`, `kind`, and `limit` filters. Each match comes back with its namespace, kind, and a one-line summary, ready to feed into `gtkx_get_api_docs`.

**`gtkx_get_api_docs`** returns the full reference page for one symbol as markdown. It accepts a qualified name (`Gtk.Button`, `Gtk.Orientation`, `GLib.idleAdd`), a JSX element name (`GtkButton`), or a bare name when it is unambiguous; if several symbols share a name, the error lists the candidates and a `kind` parameter disambiguates. Element pages are the same pages `gtkx docs` generates, covering props, signal handler props, and `ref` methods (see [generating element reference docs](/guide/configuration-and-codegen#generating-element-reference-docs)). Pages for `@gtkx/gi` symbols cover the rest of the surface: a class page lists its hierarchy, constructors, static methods, properties, signals, and instance methods with exact TypeScript signatures; enum pages list members and values; record, callback, alias, function, and constant pages follow suit.

The server resolves which project to document from the connected app: apps report their project root when they register, and that root's `gtkx.config.ts` decides the libraries and `elementProps`. With no app connected, it falls back to its own working directory, which for a stdio server is wherever your MCP client launched it, normally the project directory. The GIR data is parsed once per project and cached for the life of the server, so the first reference call takes a moment and the rest are instant.

The same pages are also published as MCP resources for clients that work resource-first: `gtkx://reference/index` is the overview, `gtkx://reference/{namespace}` one namespace's symbol list, and `gtkx://reference/{namespace}/{symbol}` one symbol's page, with completion wired up for both namespace and symbol names.

## A session in practice

Here is what the loop looks like when an agent verifies a change to the [Tasks app](/tutorial/) from the tutorial. You (or the agent) have `gtkx dev` running in the project.

1. The agent calls `gtkx_list_apps` with `waitForApps: true` and sees `com.gtkx.tutorial` with one window titled "Tasks".
2. It calls `gtkx_get_widget_tree` and reads the shape of the UI: the `AdwNavigationSplitView`, the sidebar rows, the task list, each with an ID.
3. It calls `gtkx_query_widgets` with `by: "role"`, `value: "BUTTON"`, `options: { name: "New List" }` to pin down the exact button, then `gtkx_click` on the returned ID.
4. The dialog opens. The agent re-fetches the tree (the dialog's widgets are new, with new IDs), finds the name entry, and calls `gtkx_type` with `clear: true` and the text "Groceries".
5. It clicks the confirm button, then calls `gtkx_take_screenshot` with a `path` under the project to capture the sidebar showing the new list, and reads the returned image to confirm the row rendered correctly.
6. You ask for the list rows to gain a subtitle. The agent calls `gtkx_get_api_docs` with `AdwActionRow` to check the exact prop name and type, edits the component, `gtkx dev` applies it with Fast Refresh, and one more screenshot confirms the result, all without restarting the app or losing its state.

The pattern generalizes: inspect to find IDs, interact, screenshot to verify, repeat. Because the queries and events are the same primitives as `@gtkx/testing`, a flow the agent has just exercised by hand translates directly into a regression test, which is a productive division of labor: explore interactively over MCP, then codify what matters in Vitest. The [testing guide](/guide/testing) covers that side.

## Next

- [Testing](/guide/testing) covers `@gtkx/testing` itself: the queries, `userEvent`, and the Vitest setup the MCP tools are built on.
- The [tutorial's testing chapter](/tutorial/testing) applies both to the Tasks app.
