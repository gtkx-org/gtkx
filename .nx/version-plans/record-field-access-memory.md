---
__default__: patch
---

Reading or writing a field of a record, such as `Gdk.RGBA.red` or the values passed to `new Graphene.Point({ x, y })`, no longer allocates native memory on every access. Apps that touched record fields every frame grew by hundreds of megabytes until garbage collection, and each access was slower than necessary.
