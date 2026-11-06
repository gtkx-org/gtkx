---
__default__: patch
---

Vitest workers no longer stay alive after the Vitest process that started them is stopped by a signal. A task runner cancelling `vitest run`, an editor's stop button or a CI step timeout used to leave each GTKX worker running with its Sway compositor and D-Bus session, and later runs could not reclaim them while they lived. Workers now exit once they have nothing left to run and tear their headless display down as they go.
