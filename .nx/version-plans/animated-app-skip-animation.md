---
__default__: patch
---

An application's own `Globals.assign({ skipAnimation })`, such as an in-app animations preference, now survives changes to the desktop's reduced-motion setting. `@gtkx/animated` used to reset `skipAnimation` from `gtk-enable-animations` whenever either motion setting changed; it now applies `gtk-enable-animations` only when that setting itself changes.
