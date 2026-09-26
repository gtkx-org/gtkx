---
title: "Native Values"
description: "Pass GTypes and GValues to native methods and read generated return values."
---

# Native Values

Most generated methods accept JavaScript values directly. This guide covers the native type and value wrappers you may encounter when calling lower-level APIs.

## Passing a GType

GTKX accepts a registered class wherever a binding takes a GType:

```ts
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";

const store = Gio.ListStore.new(Gtk.Label);
```

Generated classes and interfaces, and subclasses registered with `registerClass`, can be passed this way. A plain JavaScript subclass has no registration of its own. Returned GTypes and signal handler arguments remain `bigint` values.

## Passing a GValue

When a binding reads a `GObject.Value`, GTKX usually accepts the JavaScript payload directly:

```ts
import * as Gdk from "@gtkx/gi/gdk";

const provider = Gdk.ContentProvider.newForValue("Copied text");
```

Use an explicitly initialized `GObject.Value` when the operation requires a particular native type, including an interface type for clipboard or drag-and-drop matching. A binding that fills a value instead takes a new, uninitialized `GObject.Value`; its generated signature identifies this case. Signal handlers continue to receive the value object.

For nullable value parameters, `null` means no value object. To represent a typed null payload, create a value with the required type and set its payload to null.

### Generated return values

Returned byte sequences use `Uint8Array`; byte inputs accept `Uint8Array` or `number[]`. Returned `GObject.Value` objects are unpacked to their payloads, typed as `unknown`.

Promisified operations omit a redundant success boolean when failure already rejects. Inout records and boxed values are updated in place without being repeated in the return value. See [Async Operations](/v2/guide/async-operations) for promise usage.

## Next

[Async Operations](/v2/guide/async-operations) covers promises, cancellation, and errors from native calls.
