---
__default__: patch
---

`create-gtkx` installs the React, `@types/react` and Vitest majors that GTKX declares as peers, the Vite range `@gtkx/cli` depends on, and the `@types/node` major of the oldest supported Node.js, rather than their `latest` releases. A new React or Vitest major therefore no longer gives fresh apps versions the installed GTKX does not support; move to it after `gtkx upgrade` brings a GTKX release that does.
