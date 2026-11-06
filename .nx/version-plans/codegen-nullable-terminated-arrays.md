---
__default__: patch
---

Zero-terminated arrays that GIR marks nullable now return `null`, as their types and GJS say, instead of an empty array. `Gio.DataInputStream.readLine` and `readLineAsync` return `null` at the end of the stream, so a read loop no longer spins forever on empty lines.
