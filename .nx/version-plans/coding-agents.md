---
__default__: patch
---

The `AGENTS.md` section that `gtkx codegen` writes lists only installed tools and stays unchanged after Prettier or oxfmt reformat it, and `agents.rules: false` and `agents.reference: false` remove what they turn off. New projects and `gtkx mcp init` register the MCP server as `npx --no gtkx mcp`, so a client never installs an unrelated `gtkx` package; rerun `gtkx mcp init` or add `--no` to existing entries. `gtkx mcp init --client codex` writes the project's `.codex/config.toml`.
