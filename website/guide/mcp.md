---
title: "MCP"
description: "Give AI coding agents eyes and hands on your running app: the @gtkx/mcp server exposes the widget tree, queries, clicks, typing, screenshots, and a searchable API reference for your generated bindings over the Model Context Protocol."
---

# MCP

An AI coding agent working on a web app can open the page and read the DOM. `@gtkx/mcp` gives an agent the same handle on a running GTK4 window. It is an MCP (Model Context Protocol) server that connects any MCP client, Claude Code or otherwise, to your live GTKX app.

Through it, an agent can list open windows, dump the widget tree, find widgets the way a test would, click buttons, type into entries, emit signals, and screenshot the result. It also serves a searchable API reference for your project's generated bindings, so the agent looks up exact props, signals, and method signatures instead of guessing.

Combined with the Fast Refresh loop of `gtkx dev`, that gives an agent the same edit, look, verify cycle you have. Jump to [Setup](#setup) to register the server, or read on for how it connects.

## How it connects

The system has a server half and an app half that find each other through a Unix domain socket.

The **server half** is the `gtkx-mcp` binary from the `@gtkx/mcp` package. Your MCP client launches it as an ordinary stdio MCP server. On startup it also opens a socket at `$XDG_RUNTIME_DIR/gtkx-mcp.sock` (falling back to the system temporary directory) and waits for apps to register. Because the socket path is fixed, one server serves your whole session; a second instance refuses to start while the first is alive.

The **app half** lives inside `gtkx dev`. When your entry module mounts an application, the dev runner starts an MCP client in the app process. It connects to that same socket and registers the app's application ID, process ID, and project root.

If the server is not running yet, the client silently retries every two seconds, so the order never matters: start the agent first or the app first, and they connect whenever both are up. Several apps can register with one server. Every tool that targets a running app takes an optional `applicationId` and defaults to the first connected app; `gtkx_list_apps` takes none. The API reference tools are development-time and are not tied to a running app: they take an optional `projectRoot` instead.

Clicking, typing, querying, and screenshots all delegate to [`@gtkx/testing`](/guide/testing), loaded through your app's own module graph: `gtkx_click` runs `userEvent.click`, `gtkx_query_widgets` runs the `findAllBy*` queries, and the widget tree is rendered by `prettyWidget`.

All of this is development tooling. The MCP client is part of the CLI's dev runner, not your application code, so `gtkx build` bundles none of it and a production app has nothing listening.

## Setup

`@gtkx/testing` must be resolvable from your project. Every widget tool except `gtkx_list_apps` loads it through your app's module graph and fails without it; the API reference tools never touch the app. Projects scaffolded with the testing option already have it. Otherwise install it:

```bash
npm install -D @gtkx/testing
```

Nothing else is needed on the app side: `gtkx dev` starts the client automatically whenever your entry mounts an application. On the agent side, register `gtkx-mcp` as a stdio server. For Claude Code:

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

The binary takes no arguments and has no configuration of its own. If the agent calls a tool before any app has connected, the error names the fix: "No GTKX application connected: start an app with 'gtkx dev' to connect".

## The tools

The server groups its tools into inspection, interaction, and the API reference:

| Tool | Kind | What it does |
|---|---|---|
| `gtkx_list_apps` | Inspection | List connected apps and their open windows |
| `gtkx_get_widget_tree` | Inspection | Dump an app's widget hierarchy with IDs |
| `gtkx_query_widgets` | Inspection | Find widgets by role, text, name, or label |
| `gtkx_get_widget_props` | Inspection | Read one widget's summary and its subtree |
| `gtkx_take_screenshot` | Inspection | Capture a window as a PNG |
| `gtkx_click` | Interaction | Click a widget |
| `gtkx_type` | Interaction | Type into an editable widget |
| `gtkx_fire_event` | Interaction | Emit an arbitrary GTK4 signal |
| `gtkx_list_api` | Reference | List the bindings' namespaces, or one namespace's symbols |
| `gtkx_search_api` | Reference | Search the bindings' symbols by name |
| `gtkx_get_api_docs` | Reference | Get the full reference page for one symbol |

### Inspection

The read-only tools carry the MCP `readOnlyHint` annotation, so clients that gate destructive actions can run them freely.

**`gtkx_list_apps`** lists every connected app with its application ID, process ID, and open windows (each with an ID and title). Pass `waitForApps: true` to block until at least one app registers, with `timeout` in milliseconds (default 10000). This is the natural first call in any session, especially right after launching `gtkx dev`, when the app may still be starting.

**`gtkx_get_widget_tree`** returns an app's widget hierarchy as an indented, HTML-like tree. Each widget appears as a tag named after its class, with its `id`, widget `name`, and accessible `role` as attributes, and its text content nested inside. A widget that is insensitive or invisible also carries an `accessible-disabled` or `accessible-hidden` flag. The output is truncated at 7000 characters; raise the limit by starting the app with `DEBUG_PRINT_LIMIT=50000 gtkx dev`. An excerpt looks like this:

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

This is the map the agent navigates by, and the fullest source of the widget IDs that `gtkx_get_widget_props`, `gtkx_take_screenshot`, and the interaction tools take.

**`gtkx_query_widgets`** finds widgets the way a test does, without dumping the whole tree. It takes `by` (one of `"role"`, `"text"`, `"name"`, `"labelText"`), a `value` to match, and an `options` object with `exact` (exact versus substring matching), `timeout`, and `name` (accessible-name filter, honored only when `by` is `"role"`). Role values are the `Gtk.AccessibleRole` member names:

```json
{
    "by": "role",
    "value": "BUTTON",
    "options": { "name": "New List" }
}
```

That call finds every button whose accessible name is "New List" and returns each match with its ID and serialized properties. These are the same queries as `findAllByRole`, `findAllByText`, `findAllByName`, and `findAllByLabelText` in `@gtkx/testing`, with the same matching semantics, so anything you have learned about querying in tests transfers directly.

**`gtkx_get_widget_props`** takes a `widgetId` and returns a fixed summary of that widget, plus the same summary for every widget beneath it: type, accessible role, name, text, sensitivity, visibility, and CSS classes. That fixed set is what the tool reads, not arbitrary GObject properties, so use it to re-check one branch of the interface after an interaction, for example to confirm a button became insensitive (its `isSensitive` flag) or a row picked up a CSS class (its `cssClasses`).

**`gtkx_take_screenshot`** captures a window and returns it as base64 PNG image content. `windowId` selects a window (defaulting to the first), and an optional absolute `path` also writes the PNG to disk on the app's machine, creating directories as needed, which is how agents save screenshots into a repository for documentation or visual comparison. A screenshot shows results but cannot be clicked; widget IDs for interaction always come from the tree or a query.

Widget IDs are stable for as long as a widget stays mounted: the app re-walks its toplevel windows on every request and each widget keeps the same ID for its lifetime. An ID stops resolving once its widget is unmounted, so after a dialog closes, a list re-renders, or Fast Refresh replaces a component, the agent re-fetches the tree or re-queries instead of reusing stale IDs.

### Interaction

The mutating tools carry the `destructiveHint` annotation, so clients that ask for confirmation before mutations will do so here.

**`gtkx_click`** clicks the widget with the given `widgetId`. It works on anything `userEvent.click` handles: buttons, check buttons, switches, rows, and other activatable widgets.

**`gtkx_type`** types `text` into an editable widget such as a `GtkEntry` or `GtkTextView`. Pass `clear: true` to empty the widget first, which is how you replace a value instead of appending to it.

**`gtkx_fire_event`** emits an arbitrary GTK4 `signal` on a widget, with an optional `args` array, for interactions `gtkx_click` and `gtkx_type` do not cover: emitting `close-request` on a window, or a custom signal your code connects to. Each argument can be a raw value or a `{ type, value }` object, in which case the `value` is passed through.

::: info
Every widget tool call, inspection or interaction, is routed to the app with a 30 second timeout, so a hung app surfaces as a tool error rather than a stuck agent.
:::

### API reference

The reference tools answer from the same GObject-Introspection data your bindings are generated from, so what they document is exactly what `@gtkx/gi` and `@gtkx/jsx` export: the same camelCase methods, the same promisified async pairs, the same JSX props and `on<Signal>` handlers. They need no running app and no `@gtkx/testing`; the only requirement is a project with codegen enabled, since a `codegen: false` project has no generated bindings to document. They are all read-only.

All three take an optional `projectRoot` alongside their own arguments, which decides the project they answer for.

**`gtkx_list_api`** without arguments returns an overview of every namespace the configured libraries pull in, with symbol and JSX element counts. With a `namespace` it lists all of that namespace's symbols grouped by kind: JSX elements, classes, enums, and the rest.

**`gtkx_search_api`** finds symbols by a case-insensitive substring of their name, with optional `namespace`, `kind`, and `limit` filters. Each match comes back with its namespace, kind, and a one-line summary, ready to feed into `gtkx_get_api_docs`.

**`gtkx_get_api_docs`** returns the full reference page for one symbol as markdown. It accepts a qualified name (`Gtk.Button`, `Gtk.Orientation`, `GLib.Variant`), a JSX element name (`GtkButton`), or a bare name when it is unambiguous. When several symbols share a name, the error lists the candidates, and a `kind` parameter disambiguates.

Element pages match the ones `gtkx docs` generates: hierarchy, children, props, `on<Signal>` handler props, and `ref` methods (see [generating element reference docs](/guide/configuration-and-codegen#generating-element-reference-docs)). Pages for `@gtkx/gi` symbols cover the rest.

What the reference documents depends on a project, since that project's `gtkx.config.ts` decides which libraries are bound. Pass `projectRoot` to say which one: any directory inside the project works, absolute or relative to the server's working directory, because the lookup walks up to the enclosing `gtkx.config.ts`.

Without it, the server documents the project containing its own working directory, which for a stdio server is wherever your MCP client launched it, normally the project you are working on. Only when that directory is not inside a GTKX project does it fall back to a connected app's project root, which apps report when they register.

Every answer ends with the project it was scoped to and how that project was chosen, so an answer scoped to the wrong surface is visible rather than silent:

```
Project: /home/you/tablestar (found from the working directory)
```

The GIR data is parsed once per project and cached, and re-parsed only when `gtkx.config.ts` or the GIR files change, so the first reference call for a project takes a moment and later ones are instant.

The same pages are also published as MCP resources for clients that work resource-first: `gtkx://reference/index` is the overview, `gtkx://reference/{namespace}` one namespace's symbol list, and `gtkx://reference/{namespace}/{symbol}` one symbol's page, with completion wired up for both namespace and symbol names. A URI carries no project, so resources use the same default: the working directory's project, then a connected app's.

## Next

- The [API reference](/reference/) documents the GTKX packages themselves. The generated bindings (`@gtkx/gi`, `@gtkx/jsx`) are specific to your project's configured libraries, which is what `gtkx_get_api_docs` reads; `gtkx docs` writes the element pages of that same reference to disk.
- The [tutorial's testing chapter](/tutorial/testing) applies the queries and events behind these tools to the Tasks app.
