---
__default__: minor
---

Apps in a workspace that share generated bindings can now import only the libraries they declare in `libraries` and their dependencies. Importing a namespace that only another app declared used to work in `tsc`, `gtkx dev`, Vitest and `gtkx build`, and the app then failed once installed by `gtkx deploy`; it now fails with an error naming the library to add. Shared component packages still see every library the workspace's apps declare.
