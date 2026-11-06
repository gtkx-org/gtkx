---
__default__: patch
---

Tests that load images no longer leave a `gtkx-xdg-*` directory behind after every `vitest run`. GTK decodes images in sandboxed loader processes that inherit the worker's headless runtime, and the worker's teardown waited for them until Vitest killed it, so the next run reported a stale headless runtime directory. Teardown now stops every process still running in the worker's runtime before removing it.
