---
title: "Subclassing GObject"
description: "Register a TypeScript class when native code needs a distinct GType."
---

# Subclassing GObject

Prefer JSX composition. Register a class only when GTK needs a distinct GType, such as a native model interface, a vfunc override, or a type instantiated by native code.

## Register properties and signals

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
```

GType names share the process, so prefix them. Declare property members without initializers; otherwise a field shadows the generated GObject accessor. JavaScript keys use camel case while ParamSpec names use canonical dash case. Bind the class returned by `registerClass` when options add typed properties or signals.

## Override native behavior

Generated vtable slots are `vfunc` methods:

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

Chain a parent slot with `super` when it has a generated member, or [`callParent`](/reference/@gtkx/runtime/functions/callParent) when it does not. Never call a live instance's `vfunc` as an ordinary method because that dispatches the slot again.

List native interfaces in `implements` and implement their generated `Impl` types. The parent must satisfy every prerequisite. Prefer implementing an interface over extending a concrete collection whose state would conflict.

## Render and initialize safely

A registered widget has no generated JSX export. Create one from its GType name with `createElementComponent`, using its generated ancestor props. Use `defineElements` only when attachment or creation behavior also differs.

`vfuncConstructed` can run during `super()`, before JavaScript field initializers and the constructor body. Native code can also instantiate the GType without running the JavaScript constructor. State required by native-created instances belongs in GObject properties or must be initialized from `vfuncConstructed`.

Thrown errors cross a vfunc boundary only when the C signature has a `GError**`. Keep other overrides small and synchronous. The [`registerClass` reference](/reference/@gtkx/runtime/functions/registerClass) documents options, ParamSpecs, signals, interfaces, and failure cases.
