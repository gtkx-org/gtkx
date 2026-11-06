---
__default__: patch
---

`gtkx build` no longer fails at random with `did not resolve to a file-backed asset` on a stylesheet imported with `?resource`, such as `import "../data/style.css?resource=/org/example/App/style.css"`. A Rolldown bug let overlapping resolves lose the marker that keeps such a stylesheet a GResource file, so it was sometimes treated as an injected stylesheet instead.
