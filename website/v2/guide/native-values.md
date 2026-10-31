---
title: "Native Values"
description: "Pass GTypes and GValues to native methods and read generated return values."
---

# Native Values

Most generated methods accept JavaScript values directly. This guide covers the native type and value wrappers you may encounter when calling lower-level APIs.

## Passing a GType

GTKX accepts a registered class wherever a binding takes a GType:

```ts
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";

const isWidget = GObject.typeIsA(Gtk.Label, Gtk.Widget);
```

Generated classes and interfaces, and subclasses registered with `registerClass`, can be passed this way. A plain JavaScript subclass has no registration of its own. GTypes returned by bindings or passed to signal handlers remain `bigint` values.

Generated enumerations, flags and error domains whose type is registered with GObject can be passed the same way, and carry their GType as `__type__`, like classes. Reading it registers the type, so use it rather than `GObject.typeFromName`, which finds a type only once something has registered it. JSX props that take a GType accept the `__type__` value:

```tsx
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwEnumListModel } from "@gtkx/jsx/adw";

const isEnum = GObject.typeIsA(Gtk.SortType, GObject.TYPE_ENUM);
const orders = <AdwEnumListModel enumType={Gtk.SortType.__type__} />;
```

A GType that GObject rejects for a construct property, such as the `0n` `typeFromName` returns for a type nobody registered, throws a `RangeError` instead of constructing the object without it.

## Passing a GValue

When a binding reads a `GObject.Value`, GTKX usually accepts the JavaScript payload directly. For example, a `GtkDragSource` can use this `onPrepare` handler:

```ts
import * as Gdk from "@gtkx/gi/gdk";

const prepareDrag = () => Gdk.ContentProvider.newForValue("Copied text");
```

`onPrepare` must return its provider synchronously, so this native callback creates it directly. Create persistent GObjects through JSX.

Use an explicitly initialized `GObject.Value` when the operation requires a particular native type, including an interface type for clipboard or drag-and-drop matching. A binding that fills a value instead takes a new, uninitialized `GObject.Value`; its generated signature identifies this case. Signal handlers continue to receive the value object.

For nullable value parameters, `null` means no value object. To represent a typed null payload, create a value with the required type and set its payload to null.

### Generated return values

Returned byte sequences use `Uint8Array`; byte inputs accept `Uint8Array` or `number[]`. Returned `GObject.Value` objects are unpacked to their payloads, typed as `unknown`.

Promisified operations omit a redundant leading success boolean from multi-value finish results; boolean-only results remain booleans. Inout records and boxed values are updated in place without being repeated in the return value. See [Async Operations](/v2/guide/async-operations) for promise usage.

## Reading embedded records

A record or union field that embeds another record by value, such as `Pango.Item.analysis` or the members of a `Poppler.Action`, reads as a view into the parent's memory, as in GJS:

```ts
import * as Poppler from "@gtkx/gi/poppler";

const describeAction = (action: Poppler.Action) =>
    action.type === Poppler.ActionType.GOTO_DEST
        ? `${action.any.title} (page ${action.gotoDest.dest.pageNum})`
        : action.any.title;
```

A view reflects later changes to the parent and keeps the parent alive while it is reachable. A view of a value lent to a callback expires with that value when the callback returns. When the embedded record holds pointers, the field is read-only, because copying a whole record would alias pointers the parent already owns.

## Next

[Async Operations](/v2/guide/async-operations) covers promises, cancellation, and errors from native calls.
