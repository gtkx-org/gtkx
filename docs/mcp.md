# MCP server

`@gtkx/mcp` is a Model Context Protocol server that lets an AI agent inspect and drive a running gtkx application. It exposes a catalog of widget-inspection and interaction tools to an AI client over stdio, and bridges each tool call to a live app over a Unix-domain socket.

The package owns the server and the protocol/transport side. The matching client — the part that attaches a running app and answers requests — lives in the gtkx CLI dev runner and reuses the protocol types and transport this package exports.

## Two servers in one process

The server wires together two distinct roles:

- An MCP server that talks to the AI client over a stdio transport. This is the front: it advertises the tool catalog and receives tool calls.
- A socket server bound to a Unix socket that gtkx apps connect to. This is the back-channel: every tool call is translated into a request sent to a connected app.

Starting the server opens the listening socket, then connects the MCP server to stdio; stopping it closes both, idempotently, and a graceful-shutdown handler ties stop to process signals.

Diagnostics go to **stderr**, never stdout. Stdout is reserved for the MCP stdio protocol.

## Inverted client/server roles

The transport role and the request-initiation role are deliberately opposite:

- The gtkx **app** is the socket **client** — it dials the Unix socket.
- The MCP **server** is the request **initiator** for every widget and app operation.

The app only sends registration and unregistration to the server. Everything else — fetching the widget tree, querying widgets, clicking, typing, firing events, screenshots — flows server → app, and the app responds. The app-side dispatcher rejects any method outside the agreed set.

## Wire protocol

The IPC protocol is newline-delimited JSON: one message per line, each either a **request** (`id`, `method`, optional `params`) or a **response** carrying the same `id` with either a result or a structured error. The issuer of a request generates the `id`; the responder echoes it so the initiator can correlate replies. Both shapes are schema-validated. The protocol runs symmetrically on both ends — the server initiates widget requests and the app initiates registration, so each side both sends requests and answers them.

The rendezvous socket path is a fixed file under the XDG runtime directory, falling back to the OS temp directory.

## Transport layer

A per-connection protocol engine drives the wire on both server and app sides. It buffers incoming bytes and splits them into lines, parses and validates each line as a request or response, and correlates outbound requests against their replies through a pending map armed with per-request timeouts. Malformed input surfaces as an invalid-request error; a reply carrying an error rejects the matching pending request with a reconstructed error. When the underlying writer closes, all in-flight requests are failed at once.

A small adapter turns a Node socket into one of these transports.

### Connection bookkeeping

Two layers sit between the socket and the tool handlers:

- A low-level connection store: for each accepted socket it creates a transport, tracks it by a generated id, re-emits the transport's request and lifecycle events, and answers malformed frames.
- An app-level router: it owns the set of registered apps keyed by application id, maps connections to apps, handles register/unregister, and routes outbound tool requests to a target app.

Routing resolves a target — the named app, or the first registered app when none is specified — then issues the request through that app's transport, dropping the app on a write failure. Callers can wait for an app to register, resolving immediately if one already has.

## Socket lifecycle and single ownership

The socket server manages the listening socket. On start, if the socket file already exists it probes it: if another live server answers it refuses to start; otherwise it treats the file as stale and unlinks it before binding. Only one MCP server can own a socket path at a time. Stopping rejects all pending requests, closes the listener, unlinks the socket file, and clears the registry.

## Tool catalog

The MCP server registers an AI-facing tool catalog, each tool with its own input schema. Tools that target a widget or app accept an optional application id; when omitted, the request goes to the first registered app. The catalog covers:

| Tool | Result |
| --- | --- |
| list apps | apps and their windows |
| get widget tree | a pretty-printed widget tree |
| query widgets | matching serialized widgets |
| get widget props | one serialized widget |
| click / type / fire event | acknowledgment |
| take screenshot | a base64 PNG image |

The list-apps tool can additionally block until at least one app registers — useful while an app is still starting. A small set of forwarding helpers builds each tool from a declaration: stripping the optional application id, forwarding the rest as IPC params, and shaping the app's reply as JSON text, a fixed acknowledgment, or image content.

## Widget identity

Widget IDs are **not** stable GTK handles. The app side assigns them lazily, handing out incrementing string ids keyed by widget. Before answering any request the app rebuilds its id→widget lookup by walking toplevel windows and their child chains. IDs are therefore only meaningful relative to a recent tree or query call against the same connected app; a rebuild keeps an id already given to a widget but refreshes the table.

## How the app fulfills requests

The app-side counterpart lives in the CLI and is started by the dev runner as an embedded client. It connects to the rendezvous socket, registers itself, and answers server-initiated requests; on socket close it reconnects after a delay and re-registers, best-effort unregistering on disconnect.

For each incoming request it refreshes its widget registry, resolves the application, and dispatches to a handler. Handlers fulfill the contract through the gtkx testing module — role/text/name queries, simulated click/type/clear, event firing, screenshots, and tree pretty-printing — and project each widget into a serialized shape (id, type, role, name, text, sensitivity, visibility, CSS classes, children) defined by this package.

## End-to-end flow

```
AI client ──(MCP stdio)──> MCP server ──> tool handler
                                              │ route to app (method, params)
                                              ▼
                                    connection router ──> transport request
                                              │  {id, method, params}\n   (NDJSON, Unix socket)
                                              ▼
                                    gtkx app  embedded client
                                              │ refresh registry, dispatch handler
                                              │ (testing utils + serialize widget)
                                              ▼
                                    {id, result}\n  ──> transport correlates by id
                                              ▼
                              tool shapes reply (JSON / ack / image) ──> AI client
```

On socket close or a failed write the app is dropped and its pending requests are rejected; the app-side client reconnects and re-registers.

## Package surface

The package re-exports the protocol contract for the app-side client to reuse: the rendezvous socket path, the request message type and method-name union, the per-method param schemas, the serialized-widget shape, the structural param-schema interface, the shared error type with the factories the app needs to construct matching error shapes, and the per-connection transport with its closed-writer error. The server, its handle, and the server-internal error factories stay internal to the package.
