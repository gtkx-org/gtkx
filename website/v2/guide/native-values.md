---
title: "Native Values"
description: "Pass GTypes, GValues and integers to native methods and read generated return values."
---

# Native Values

Most generated methods take and return plain JavaScript values. This page covers the cases that differ: GTypes, `GObject.Value`, integers, byte arrays and records.

## Passing a GType

GTKX accepts a registered class wherever a binding takes a GType:

```ts
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";

const isWidget = GObject.typeIsA(Gtk.Label, Gtk.Widget);
```

Generated classes and interfaces, and subclasses registered with `registerClass`, can be passed this way. A plain JavaScript subclass that skipped `registerClass` has no GType of its own, and passing it throws a `TypeError`. GTypes returned by bindings or passed to signal handlers remain `bigint` values.

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

When a binding takes a `GObject.Value`, pass the JavaScript payload and GTKX infers its type: a string becomes a `gchararray`, a number a `gint` or `gdouble`, and an object its own class's type. For example, a `GtkDragSource` can use this `onPrepare` handler:

```ts
import * as Gdk from "@gtkx/gi/gdk";

const prepareDrag = () => Gdk.ContentProvider.newForValue("Copied text");
```

`onPrepare` returns its provider synchronously, so the handler creates it directly. Create long-lived GObjects through JSX.

When the operation needs a type inference cannot select, such as an enumeration or an interface, initialize a `GObject.Value` yourself. Clipboards and drop targets match content by GType, and a file passed directly is offered as its implementation class, `GLocalFile`, rather than `GFile`:

```ts
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";

const fileProvider = (file: Gio.File) => {
    const value = new GObject.Value();
    value.init(Gio.File);
    value.setObject(file);

    return Gdk.ContentProvider.newForValue(value);
};
```

A binding that fills a value, such as `Gdk.ContentProvider.getValue`, takes a `GObject.Value` you create; its documentation says whether to initialize it first. Signal handlers receive the value object rather than its payload.

For nullable value parameters, `null` means no value object. To represent a typed null payload, create a value with the required type and set its payload to null.

## Generated return values

Returned byte arrays are `Uint8Array`; byte inputs accept `Uint8Array`, `Uint8ClampedArray` or `number[]`. A returned `GObject.Value` is unpacked to its payload, typed as `unknown`. Inout records and boxed values are updated in place rather than repeated in the return value. [Async Operations](/v2/guide/async-operations) covers what promisified operations resolve to.

## Records passed to callbacks

A record that a signal handler or callback receives stays valid until the handler returns. Reference-counted records, such as `WebKit.ScriptMessageReply`, are the exception: the handler may keep one and use it later, for example to answer once an asynchronous operation finishes.

## Passing integers

Integer parameters, properties and vfunc results take whole numbers within their native type's range. GTKX throws a `RangeError` for any other number, such as `Value 10922.4 is not an integer, int32 expects a whole number`, where GJS truncates a fractional number silently. Code ported from GJS that computes sizes or positions with fractional arithmetic must round each value before passing it:

```ts
import * as Pango from "@gtkx/gi/pango";

const shrinkFont = (description: Pango.FontDescription, size: number) =>
    description.setSize(Math.round(size * 0.8));
```

The same applies to sizes a [vfunc returns](/v2/guide/subclassing#subclass-virtual-methods) and to fields of records such as `Gdk.Rectangle`. Use `Math.trunc` to keep GJS's behavior exactly.

## Reading embedded records

A record or union field that embeds another record by value, such as `Pango.Item.analysis` or the members of a `Poppler.Action` (`action.any.title`), reads as a view into the parent's memory, as in GJS:

```ts
import * as Pango from "@gtkx/gi/pango";

const isRightToLeft = (item: Pango.Item) => item.analysis.level % 2 === 1;
```

A view reflects later changes to the parent and keeps the parent alive while it is reachable. A view of a value lent to a callback expires with that value when the callback returns. When the embedded record holds pointers, the field is read-only, because copying a whole record would alias pointers the parent already owns.
