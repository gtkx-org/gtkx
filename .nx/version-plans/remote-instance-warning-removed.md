---
__default__: patch
---

Launching an application while another process already owns its application ID no longer prints GTKX's "Another process already owns ..." warning, in production or under `gtkx dev`. The launch still forwards its activation or files to the running instance and exits quietly, as C and GJS applications do. `gtkx dev` still stops with status 1 in that case.
