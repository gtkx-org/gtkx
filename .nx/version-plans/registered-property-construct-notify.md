---
__default__: patch
---

A registered class's own properties now emit `notify` whenever their stored value changes, as GJS does. A binding or `notify` handler connected in `vfuncConstructed` used to miss the values passed to the constructor, such as a custom element's props, because GLib sets those after `constructed` without notifying handlers connected there.
