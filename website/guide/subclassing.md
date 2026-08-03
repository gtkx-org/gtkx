---
title: "Subclassing GObject"
description: "Turning a TypeScript class into a real GType with registerClass: properties, virtual function overrides, chaining up, and what an override of constructed can see."
---

# Subclassing GObject

Most of a GTKX app is JSX, and JSX never needs a subclass. You reach for one when something outside your render tree has to be a GObject in its own right: a list model backing a `GtkListView`, a widget whose measuring or snapshotting you want to control, an object with properties a `GtkExpression` can read, or a type you name in a `GtkBuilder` file.

`registerClass` from `@gtkx/runtime` takes a TypeScript class that extends a generated wrapper class and registers it as a new GType.

```ts
import { Object as GObject } from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class Counter extends GObject {}

registerClass(Counter, { typeName: "ExampleCounter" });

new Counter();
```

The class must extend a registered wrapper class, directly or through other subclasses of your own. `typeName` defaults to the class's name; GType names live in one process-wide namespace, so prefix yours with something specific to your app.

## Properties

Pass `properties` to install GObject properties on the new type, keyed by the name you want in JavaScript and valued with the `GObject.ParamSpec` describing each one:

```ts
import { Object as GObject, ParamFlags, paramSpecInt } from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class Swatch extends GObject {
    declare red: number;
}

registerClass(Swatch, {
    typeName: "ExampleSwatch",
    properties: { red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE) },
});

const swatch = new Swatch();
swatch.red = 200;
```

Each property gains dashed, underscored and camelCased prototype accessors that emit `notify` on write, so `swatch.red = 200` and `swatch.setProperty("red", value)` are interchangeable, and a native consumer such as `Gtk.PropertyExpression` reads the value without calling back into JavaScript.

Declare the field with `declare` rather than an initializer. The accessors live on the prototype, and a class field would shadow them on every instance.

## Overriding virtual functions

Every vtable slot a parent type exposes is a `vfunc`-prefixed member on the generated wrapper class: `GtkWidgetClass.measure` is `vfuncMeasure`, `GObjectClass.constructed` is `vfuncConstructed`. Override the member and `registerClass` installs your implementation into the new type's vtable.

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

`super.vfuncMeasure(...)` chains up to the implementation the override replaced, one level at a time, so a hierarchy of overrides runs top to bottom. Arguments follow the same convention a call does: pure out parameters are left out of the signature and returned instead, and a slot with several outputs returns them as a tuple.

Overrides of slots an interface declares work the same way, as long as the parent type already implements the interface.

Those `vfunc` members are direct vtable invocations, and that is all they are. They exist so an override can chain up; calling one from anywhere else runs the slot again on a live instance, which most slots do not expect.

### Slots with no generated member

`dispose`, `finalize`, `get_property` and `set_property` are overridable but have no generated member, so there is no `super` to call. Chain up with `callParent` instead, naming the class whose override is running:

```ts
import { Object as GObject } from "@gtkx/gi/gobject";
import { callParent, registerClass } from "@gtkx/runtime";

class Resource extends GObject {
    declare watch: number | null;

    vfuncDispose(): void {
        this.watch = null;
        callParent(Resource, "vfuncDispose", this);
    }
}

registerClass(Resource, { typeName: "ExampleResource" });
```

`callParent` works for every slot, including the ones that do have a member.

A class that defines `vfuncSetProperty` or `vfuncGetProperty` itself backs that direction with its own method; the other direction still gets the accessor dispatch generated from `properties`.

## What an override of `constructed` can see

`vfuncConstructed` is the usual place to finish setting an object up, because GObject calls it once all construct properties have been set. In GTKX its `this` is the wrapper `new` is about to return: the native handle is bound, properties read back, and method calls on it stick.

```ts
import * as Gio from "@gtkx/gi/gio";
import { Object as GObject, TYPE_OBJECT } from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class ReadyStore extends Gio.ListStore {
    override vfuncConstructed(): void {
        super.vfuncConstructed();
        this.append(new GObject({}));
    }
}

registerClass(ReadyStore, { typeName: "ExampleReadyStore" });
new ReadyStore({ itemType: TYPE_OBJECT }).getNItems(); // 1
```

What it cannot see is any state your subclass declares in JavaScript. `constructed` fires from inside GObject's constructor, which runs while `super()` is still on the stack, and JavaScript installs a subclass's field initializers and runs its constructor body only after `super()` returns. So during `vfuncConstructed`:

- a field with an initializer still reads `undefined`, and its initializer overwrites anything the override assigned to it once construction continues;
- a `#private` field is not installed yet, and touching one throws `TypeError: Cannot read private member #x from an object whose class did not declare it`.

This is ordinary JavaScript, the same hazard as calling any overridden method from a base constructor. Private fields just turn it from a silent `undefined` into a hard error.

What works instead is to declare the state the override touches without an initializer, and to set anything private from the constructor body once `super()` has returned:

```ts
class Ready extends GObject {
    declare startedAt: number;

    #ticks: number;

    constructor() {
        super({});
        this.#ticks = 0;
    }

    override vfuncConstructed(): void {
        super.vfuncConstructed();
        this.startedAt = Date.now();
    }
}
```

Whenever the work does not have to happen before construction finishes, put it in the constructor and leave the override out of it entirely.

## Instances created from C

A registered type is a real GType, so anything can instantiate it: `GObject.newv`, `Gtk.Builder` reading a `<object class="ExampleThing"/>` element, a container that builds its own children. GTKX creates the wrapper for such an instance on demand, and it is the same object every later lookup returns, with the right class and the right handle, so an override of `vfuncConstructed` still sees a usable `this`.

What never happens on that path is your constructor. Nothing calls `new`, so field initializers never run and `#private` fields are never installed, permanently, not just during `constructed`. A class you expect `Gtk.Builder` or a native caller to instantiate should keep its state in GObject properties, or in properties it assigns from `vfuncConstructed` and never declares as initialized fields.

```ts
class Built extends Gtk.Label {
    declare tag: string;

    override vfuncConstructed(): void {
        super.vfuncConstructed();
        this.tag = "built";
    }
}

registerClass(Built, { typeName: "ExampleBuilt" });
const builder = Gtk.Builder.new();
builder.addFromString(`<interface><object class="ExampleBuilt" id="one"/></interface>`, -1);
(builder.getObject("one") as Built).tag; // "built"
```
