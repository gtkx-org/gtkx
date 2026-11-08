# @gtkx/mcp

MCP server that inspects running GTKX apps and their generated bindings.

Connect a coding agent to the live widget tree of an app started with `gtkx dev`. Its tools inspect widgets, click, type, press keys, and take screenshots. Others look up the classes, enums, and functions generated for the project.

Apps created with `npm create gtkx` already depend on this package and register it for Claude Code. Otherwise, install it with `@gtkx/testing`, which the widget tools use, and register it with your client:

```sh
npm install -D @gtkx/mcp@beta @gtkx/testing@beta
npx gtkx mcp init --client claude
```

[Guide](https://gtkx.dev/v2/guide/mcp) · [GTKX](https://gtkx.dev)

GTKX requires Linux, Node.js, and the [native prerequisites](https://gtkx.dev/v2/guide/getting-started#what-you-need).

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
