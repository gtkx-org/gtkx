---
__default__: patch
---

`gtkx mcp init --client codex` now writes the `gtkx` server to the project's `.codex/config.toml`, creating the file or adding the table to an existing one, and replaces an older `[mcp_servers.gtkx]` table on a re-run. Codex reads it once the project is trusted. The command used to print a table for the global `~/.codex/config.toml`, where the server, having no working directory, started in every directory Codex opened. It still prints the table when the file declares `gtkx` in a form it cannot edit line by line.
