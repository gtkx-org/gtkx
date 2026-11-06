---
__default__: patch
---

`create-gtkx` inside an npm workspace no longer writes `allowScripts` into the new app's `package.json`, where npm ignores it and warns on every install. It prints the `allowScripts` entries to add to the workspace root's `package.json` instead, as it already does for pnpm workspaces.
