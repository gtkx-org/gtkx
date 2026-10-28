---
__default__: patch
---

`gtkx dev` restarts the app when you edit a module's `injectGlobal` rules. Fast Refresh used to re-run the module and add the edited rules beside the old ones, so a rule you removed or whose selector you changed kept styling the window until the next restart.
