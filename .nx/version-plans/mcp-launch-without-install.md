---
__default__: patch
---

New projects and `gtkx mcp init` now register the MCP server as `npx --no gtkx mcp`. MCP clients start servers without a terminal, so plain `npx gtkx mcp` tried to install and run an npm package named `gtkx` wherever `@gtkx/cli` was not installed, such as a workspace root or a clone before its first install. With `--no`, npx exits with an error instead of installing anything. Running `gtkx mcp init` again replaces an existing `npx gtkx mcp` entry; in other projects, add `--no` before `gtkx` in the server's arguments.
