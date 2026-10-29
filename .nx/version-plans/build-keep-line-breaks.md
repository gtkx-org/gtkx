---
__default__: patch
---

`gtkx build` keeps line breaks in the minified production bundle. Node prints the line that threw before an error's stack, so an application that failed while loading, for example on a missing configuration file, printed megabytes of minified code; it now prints only the line that threw.
