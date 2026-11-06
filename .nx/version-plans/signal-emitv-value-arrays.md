---
__default__: patch
---

`GObject.signalEmitv` and `GObject.signalChainFromOverridden` now take their argument arrays like GJS, as `GObject.Value` instances or plain JavaScript values; every call used to fail with `Expected an Object for array element type, got Object`. Other generated functions that take a record array without a stated length, such as `Pango.GlyphItem.letterSpace`, accept their records the same way.
