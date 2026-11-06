---
__default__: patch
---

`gtkx mcp init` keeps the indentation of the editor configuration it updates, such as tabs in `.vscode/mcp.json`, and leaves a configuration with comments unchanged, printing the `gtkx` entry to add, instead of failing with a JSON syntax error.
