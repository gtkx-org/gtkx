---
__default__: major
---

Consolidate Toast controls into `useToast().show()` and `useToast().dismissAll()`, with individual dismissal through the returned toast. Restrict native exports to supported operations, move the generated wrapper-retention helper to the runtime internal entrypoint, isolate testing renderer errors by root, and centralize configuration dependency tracking. Allow TODO/FIXME comments and link upstream workarounds to their removal trackers.

Restrict synthetic record construction to supported initialization contracts, preserve field-allocation cleanup, and expose `GLib.String` storage fields as readonly. Native bigint codecs require bigint inputs; runtime bindings continue normalizing valid Number inputs. Render persistent collection models through JSX and share native-addon resolution between build and deployment.
