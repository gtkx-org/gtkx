---
title: "Subclassing GObject"
description: "Register a TypeScript class as a GType when native code needs its own model or widget type."
---

# Subclassing GObject

JSX composition needs no subclass. Register one only when GTK itself needs a distinct GType: for example, a model implementing a native interface, a widget overriding measurement, or a class instantiated by native code.

## Register a type

Extend a generated wrapper and pass the class to `registerClass`:

```ts
import { Object as GObject } from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class Counter extends GObject {}

registerClass(Counter, { typeName: "ExampleCounter" });
```

GType names share the process, so prefix them for the application. Bind the returned class when the call adds typed properties or signals; those declarations enter TypeScript through its return type.

## Add properties and signals

Declare property members without initializers so the GObject accessors on the prototype are not shadowed:

```ts
import { Object as GObject, ParamFlags, paramSpecInt } from "@gtkx/gi/gobject";
import { registerClass, TYPE_INT } from "@gtkx/runtime";

class MeterBase extends GObject {
    declare value: number;
}

const Meter = registerClass(MeterBase, {
    typeName: "ExampleMeter",
    properties: {
        value: paramSpecInt("value", null, null, 0, 100, 0, ParamFlags.READWRITE),
    },
    signals: {
        "limit-reached": { paramTypes: [TYPE_INT] },
    },
});

const meter = new Meter({ value: 80 });
meter.connect("limit-reached", (limit) => console.log(limit));
meter.emit("limit-reached", 100);
```

The object key is camelCase in JavaScript while the ParamSpec name uses canonical dash-case. Writes validate against the ParamSpec and emit `notify`. A method named `on<SignalName>`, such as `onLimitReached`, becomes the signal's default handler.

Use `paramSpecOverride` only when the subclass needs its own implementation of an inherited property. The generated ParamSpec and signal APIs describe every supported type, flag, accumulator, and failure condition in the [`registerClass` reference](/reference/@gtkx/runtime/functions/registerClass).

## Override native behavior

Generated vtable slots are `vfunc` methods. Override one and call `super` when the parent implementation must still run:

```ts
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";

class PaddedLabel extends Gtk.Label {
    override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): [number, number, number, number] {
        const [minimum, natural] = super.vfuncMeasure(orientation, forSize);

        return [minimum + 10, natural + 10, -1, -1];
    }
}

registerClass(PaddedLabel, { typeName: "ExamplePaddedLabel" });
```

Some GObject slots, including `dispose`, have no generated parent member. Chain those with [`callParent`](/reference/@gtkx/runtime/functions/callParent). Never invoke a `vfunc` method on a live instance as an ordinary method; that runs a dispatched slot again.

Widget-only registration options include `cssName`. Use `classInit` for one-time class-struct work such as installing actions or choosing a layout manager. Set `abstract: true` for a base type that must not be instantiated.

## Implement an interface

List an interface in `implements` and implement its companion `Impl` type. Fill every slot consumers may call:

```ts
import * as Gio from "@gtkx/gi/gio";
import { Object as GObject, TYPE_OBJECT } from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class LevelStore extends GObject implements Gio.ListModelImpl {
    rows: GObject[] = [];

    vfuncGetItemType(): bigint {
        return TYPE_OBJECT;
    }

    vfuncGetNItems(): number {
        return this.rows.length;
    }

    vfuncGetItem(position: number): GObject | null {
        return this.rows[position] ?? null;
    }
}

registerClass(LevelStore, { typeName: "ExampleLevelStore", implements: [Gio.ListModel] });
```

The parent must satisfy the interface prerequisites. `registerClass` splices the caller-side interface methods and signals into instances at runtime; the `Impl` type checks only the vtable slots the class supplies.

Prefer implementing an interface over extending a concrete collection that already owns conflicting state. A custom `Gio.ListModel`, for example, should not inherit `Gio.ListStore` while replacing its item slots.

## Render a registered widget

A registered class has no generated JSX export. Create one from its GType name:

```tsx
import type { GtkLabelProps } from "@gtkx/jsx/gtk";
import { createElementComponent } from "@gtkx/react/config";

const PaddedLabelElement = createElementComponent<GtkLabelProps<PaddedLabel>>("ExamplePaddedLabel");

<PaddedLabelElement label="Measured by the subclass" />;
```

The element inherits its ancestor props, signals, defaults, and child behavior. Use `defineElements` when the new type needs custom creation or attachment behavior.

## Keep lifecycle state safe

`vfuncConstructed` runs while `super()` is still active, before JavaScript field initializers and the constructor body. Native callers can also create the GType without running the JavaScript constructor at all. State needed by native-created instances therefore belongs in GObject properties or is initialized from `vfuncConstructed`; use the constructor for purely JavaScript-created instances.

Thrown errors cross a vfunc boundary only when its C signature has a `GError**`. Other thrown values become uncaught native-callback failures, so keep those overrides small and synchronous.

## Next

[Components](/guide/components) covers collection models that do not need a custom GType. Use the [runtime API reference](/reference/@gtkx/runtime/) for the complete registration surface.
