---
__default__: minor
---

`gtkx dev`, `build`, `codegen`, `storybook`, `deploy` and `mcp` warn when the GTKX packages installed for the project are not all on one version, naming the packages that differ and pointing to `gtkx upgrade`. Since sibling dependencies use caret ranges, a package the project does not declare, such as `@gtkx/codegen`, can resolve to a newer release than the ones it does, and nothing showed that before. The check reads only installed `package.json` files and prints nothing when the versions match.
