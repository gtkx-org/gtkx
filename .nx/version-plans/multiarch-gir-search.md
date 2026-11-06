---
__default__: patch
---

Code generation now also searches the `gir-1.0` directory under the libdir that pkg-config reports for GObject Introspection, as `g-ir-scanner` does. Debian and Ubuntu install architecture-dependent GIR files such as `Gst-1.0.gir` and `GstAudio-1.0.gir` there, so generating bindings for GStreamer libraries failed with a GIR file not found error unless `girPath` or `GTKX_GIR_PATH` named that directory.
