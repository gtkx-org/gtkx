---
__default__: patch
---

`Gio.InputStream.readAsync` and `readAllAsync` are no longer generated. They read into a buffer the caller allocates, which GTK fills after the call returns, so their bindings could never return the bytes and threw `ReferenceError: buffer is not defined` when called. As in GJS, use `readBytesAsync`, or `Gio.BufferedInputStream.fillAsync` with `peekBuffer`, to read asynchronously.
