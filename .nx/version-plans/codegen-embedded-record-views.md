---
__default__: minor
---

Record and union fields that embed another record by value now read as views into the parent's memory even when the embedded record holds pointers, as in GJS, so `action.any.title` and `action.gotoDest.dest` on `Poppler.Action`, `Pango.Item.analysis` and `Gst.Buffer.miniObject` work. A view keeps its parent alive while it is reachable. These fields are read-only, because copying the record would alias pointers the parent owns. They used to be missing from the generated bindings.
