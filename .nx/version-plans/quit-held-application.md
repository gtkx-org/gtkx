---
__default__: patch
---

`quit()` now also quits each application element it unmounts, as `application.quit()` does, so it ends an application that keeps itself running with `hold()`, such as a launcher or background service bound to `app.quit`. Such an application used to keep running with no windows after `quit()` and to own its application ID, so every later launch was forwarded to it and showed nothing. `root.unmount()`, `root.render(null)` and Fast Refresh still leave the running application alone.
