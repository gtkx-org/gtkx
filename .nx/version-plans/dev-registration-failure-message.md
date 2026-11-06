---
__default__: patch
---

`gtkx dev` no longer says the application refused its command line when it stops because it could not register its application ID, for example when another process that is not a GTKX application owns that name on the session bus. It now says that the application did not start because it rejected its command line or could not register its ID, below GLib's own message giving the reason.
