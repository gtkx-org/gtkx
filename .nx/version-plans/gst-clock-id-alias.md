---
__default__: patch
---

Generated GStreamer bindings now declare `Gst.ClockID`, so the clock methods that take one, such as `Gst.Clock.idGetTime`, type it as a `bigint` handle instead of falling back to `any`.
