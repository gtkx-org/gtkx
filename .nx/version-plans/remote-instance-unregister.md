---
__default__: patch
---

Launching an application while another process already owns its application ID, for example to open a file in the running window, now unregisters the second process from D-Bus once it hands over to the first, as `g_application_run` does. It no longer leaves GLib's "Your application did not unregister from D-Bus before destruction" warning on exit.
