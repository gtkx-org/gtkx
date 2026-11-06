---
__default__: patch
---

Closing a GLib socket, pipe or other descriptor while Node reused its number no longer aborts the process with `uv__io_poll: Assertion 'errno == EEXIST' failed` or leaves Node sockets without events. GTKX now watches GLib's descriptors through a private epoll set instead of registering each one with libuv, so stopping a `Gio.SocketService` while `gtkx dev` or the MCP server has connections open keeps the app running.
