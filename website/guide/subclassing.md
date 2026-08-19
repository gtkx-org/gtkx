---
title: "Subclassing GObject"
description: "Turning a TypeScript class into a new GType with registerClass: properties, virtual function overrides, chaining up, and what an override of constructed can see."
---

# Subclassing GObject

JSX never needs a subclass. You reach for one when something outside the render tree has to be a GObject in its own right: a list model backing a `GtkListView`, a widget that controls its own measuring, or a type you name in a `GtkBuilder` file.

`registerClass` from `@gtkx/runtime` registers such a class as a new GType. It must extend a generated wrapper class, directly or through subclasses of your own. `typeName` defaults to the class's name, and GType names share one process-wide namespace, so prefix yours with something specific to the app.

```ts
import { Object as GObject } from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class Counter extends GObject {}

registerClass(Counter, { typeName: "ExampleCounter" });
```

## Properties

`properties` installs GObject properties on the new type, keyed by the name JavaScript addresses each one by and valued with its `GObject.ParamSpec`. Bind the call to a name: the installed names reach the type system only through what it returns.

```ts
import { ParamFlags, paramSpecInt } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";

class SwatchBase extends Gtk.Widget {
    declare red: number;
}

const Swatch = registerClass(SwatchBase, {
    typeName: "ExampleSwatch",
    properties: { red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE) },
});

type Swatch = InstanceType<typeof Swatch>;

const swatch = new Swatch();
swatch.red = 200;
```

`Swatch` is a value and a type at once: the `const` is the registered class, and `InstanceType<typeof Swatch>` names its instances. Register a class *declaration*: a class expression inside the call has an anonymous type that declaration files cannot name.

Declare each property field with `declare` and never with an initializer: the accessors live on the prototype, and a class field would shadow them on every instance.

Writes go through those accessors, which validate against the ParamSpec and emit `notify`: a read-only property, a construct-only property assigned after construction, a wrong type, and an out-of-range value each throw. Set construct-only properties through the constructor, as `new Swatch({ red: 200 })`; `ParamFlags.LAX_VALIDATION` keeps GObject's tolerance for out-of-range values.

A key is read in camelCase however it is written, so `dewPoint`, `dew_point` and `dew-point` name the same member. Its ParamSpec has to carry the canonical spelling, lowercase words joined by dashes: `paramSpecInt("dew-point", …)` under a `dewPoint` key. That is the name GObject emits `notify` under, and `registerClass` throws on a mismatch.

### Properties and the hooks

`useProperty` from `@gtkx/react` takes the properties a registered class installs the same way it takes the ones a generated class arrives with:

```tsx
import { GtkLabel } from "@gtkx/jsx/gtk";
import { useProperty, useSignal } from "@gtkx/react";

function SwatchRow({ swatch }: { swatch: Swatch }) {
    const red = useProperty(swatch, "red"); // number | undefined

    useSignal(swatch, "notify::red", () => console.log("red is now", swatch.red));

    return <GtkLabel label={`red: ${red ?? 0}`} />;
}
```

Those names come off the class the call returned, which is why the example binds it to `Swatch`. Leave the `properties` object to inference for the same reason: annotated as `Record<string, ParamSpec>` its key type is `string`, which names no property in particular. `satisfies` keeps the keys and checks the values:

```ts
import type { ParamSpec } from "@gtkx/gi/gobject";

const DIAL_PROPERTIES = {
    angle: paramSpecInt("angle", null, null, 0, 360, 0, ParamFlags.READWRITE),
} satisfies Record<string, ParamSpec>;
```

Only installed properties are addressable, since nothing notifies on a plain field or a method, and the inherited ones stay addressable too: `useProperty` still takes `"label"` on a `Gtk.Label` subclass.

## Overriding virtual functions

Every vtable slot a parent type exposes is a `vfunc`-prefixed member on its wrapper class: `GtkWidgetClass.measure` is `vfuncMeasure`, `GObjectClass.constructed` is `vfuncConstructed`. Override the member and `registerClass` installs it into the new type's vtable.

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

`super.vfuncMeasure(...)` chains up to the implementation the override replaced, one level at a time. Arguments follow the convention a call does: pure out parameters are left out of the signature and returned instead, several outputs as a tuple. Never call a `vfunc` member on a live instance, which runs the slot a second time. Slots an interface declares behave the same, once the parent type implements it.

### Slots with no generated member

`dispose`, `finalize`, `get_property` and `set_property` are overridable but have no generated member, so there is no `super` to call. Chain up with `callParent`, naming the class whose override is running:

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

## Implementing an interface

A subclass inherits the interfaces its parent implements. To adopt one the parent does not provide, name it in `implements` and fill its vtable slots on the class:

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

`implements` takes the interface values themselves, `Gio.ListModel` rather than `"GListModel"`, and the `vfunc`-prefixed methods on the class become that interface's vtable. `registerClass` throws on an entry that is not a registered interface, and on one whose prerequisites the parent type does not meet: `Gtk.Editable` requires a widget, so extend `Gtk.Widget` or a subclass of it.

### The `Impl` type

Every interface with vtable slots has a companion type named after it, `Gio.ListModel` giving `Gio.ListModelImpl`. It pins the signature of every slot the class declares, so a slot with the wrong parameters or return type fails to build. A misspelled slot *name* does not: it reads as a method the type never asked about, and the slot stays unfilled.

Every member is optional, so a class writing `implements Gio.ListModelImpl` while filling no slot is rejected as a weak type; leave the clause off when the class fills nothing. An `Impl` extends the `Impl` of any interface prerequisite, while a class prerequisite is satisfied by extending it. An interface with no slots, `Gtk.Orientable` for instance, has no `Impl` type at all.

Only `vfunc`-prefixed methods on the prototype chain reach the vtable, so never write a slot as a class field: `vfuncGetSection = (): [number, number] => [1, 1]` installs nothing.

### Chaining up out of a slot you fill

TypeScript resolves `super.x` against the base class, which does not carry the interface until `registerClass` splices it in. Name the base the class ends up with:

```ts
type SplicedBase<T> = Omit<typeof GObject, never> & (new (props?: object) => GObject & T);

class Sectioned extends (GObject as SplicedBase<Gtk.SectionModel>) implements Gtk.SectionModelImpl {
    override vfuncGetSection(position: number): [number, number] {
        return super.vfuncGetSection(position);
    }

    override vfuncGetItemType(): bigint { /* ... */ }
    override vfuncGetNItems(): number { /* ... */ }
    override vfuncGetItem(position: number): GObject | null { /* ... */ }
}
```

A `declare`d member cannot stand in, because TypeScript reads it as a field and a field is not reachable through `super`. Naming the spliced base makes every slot an override, so under `noImplicitOverride` all of them need the `override` keyword.

### Throwing out of a slot you fill

A slot whose C signature ends with a `GError**`, such as `Gio.Initable`'s `vfuncInit`, reports failure by throwing. A thrown `GLib.Error` reaches the C caller with its domain, code and message intact, and any other thrown value becomes a GError in a GTKX-owned domain carrying the value's message, while the slot returns its failure value (`false`, `null` or `0`). A caller that reads the error back out through a binding, `Gio.Initable.init()` for instance, receives it as a thrown `GLib.Error` again, so [Error Handling](/guide/error-handling) applies end to end. A slot without that `GError**` has no channel to deliver an exception through, so throwing from one raises the exception as uncaught instead: see [Failures nothing can throw](/guide/error-handling#failures-nothing-can-throw).

### Slots you leave to the interface

A slot no method fills keeps whatever the interface installs by default, or nothing at all. Many entry points guard the slot for null and answer not-supported, but some call it outright: a class adopting `Gio.ListModel` without all of its slots crashes the process the moment something asks for an item count. Fill every slot the class adopts. `Gtk.SelectionModel` needs care, since its defaults for `is_selected` and `get_selection_in_range` recurse into each other until the stack runs out: fill `vfuncIsSelected`, `vfuncGetSelectionInRange`, or both.

### What instances gain

`implements` also splices the interface's members into the prototype chain, underneath the class's own methods, so instances get its caller side and its signals for free:

```ts
const store = new LevelStore();
store.connect("items-changed", (position, removed, added) => console.log(position, removed, added));
store.rows.push(new GObject({}));
store.itemsChanged(0, 0, 1);
store.getNItems(); // 1
```

TypeScript does not see the splice, because `Gio.ListModelImpl` describes only the slots. Name the combination where the caller side matters:

```ts
type Level = Gio.ListModel & LevelStore;

const level = new LevelStore() as Level;
const selection = new Gtk.SingleSelection({ model: level });
```

Inside the class, `declare` the members it calls on itself, such as `declare itemsChanged: Gio.ListModel["itemsChanged"];`.

### Why not extend a class that already has it

`Gio.ListStore` implements `GListModel`, so extending it and overriding the slots looks like a shortcut. It is not one: its own storage stays there, still empty, still answering everything the overrides do not, so `getNItems()` and the `n-items` property consumers bind to disagree. Adopt `Gio.ListModel` with `implements` instead, leaving no parent state to contradict the class.

## Elements that cannot be children

The reconciler places a child only where a behavior on the parent claims it, so nesting a GObject inside an element that does not claim it throws rather than dropping it. The error it throws names the remedies, one per nesting: pass the object to the parent prop that takes it, such as `<GtkPaned startChild={…}>`; portal it to `rootElement` with `createPortal` when it is nested only so it lives and dies with the component around it, which [Modals and Portals](/guide/modals-and-portals) covers; or register an `attach` behavior for the parent, or an ancestor type, with `defineElements`, as [Advanced: Customizing elements](/guide/configuration-and-codegen#advanced-customizing-elements) describes. GTKX ships that portal wrapper for `GtkSizeGroup` itself, which is why the element can sit among the widgets it groups.

## Rendering a registered class

A class `registerClass` created has no generated element. `createElementComponent` from `@gtkx/react/config` builds one for any GType name, here for the `Swatch` registered above:

```tsx
import type { GtkWidgetProps } from "@gtkx/jsx/gtk";
import { createElementComponent } from "@gtkx/react/config";

type SwatchProps = GtkWidgetProps<Swatch> & { red?: number };

const SwatchElement = createElementComponent<SwatchProps>("ExampleSwatch");

<SwatchElement red={200} widthRequest={48} />;
```

The element name is the `typeName` the class was registered under, and the element inherits the props, signal handlers, defaults and behaviors of every ancestor type, so a `Gtk.Widget` subclass takes `cssClasses`, `halign` and `onNotifyVisible` already. Name the props as the type argument, since a component left at the default accepts no attributes at all.

Properties the class installs itself are applied after construction, so one that has to be set at construction wants a `create` behavior registered with `defineElements` under the same type name.

## What an override of `constructed` can see

`vfuncConstructed` runs once all construct properties are set, on the usable wrapper `new` is about to return, which makes it the place to finish an object off.

It cannot see state the subclass declares in JavaScript: it fires while `super()` is still on the stack, before field initializers and the constructor body run, so a field reads `undefined` and touching a `#private` field throws. Declare the state the override touches without an initializer, and set anything private from the constructor body:

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

Put the work in the constructor instead whenever it can wait until construction finishes.

The constraint is permanent for an instance something else creates: `GObject.newv`, a `Gtk.Builder` reading an `<object class="ExampleThing"/>` element, and a container building its own children never call `new`, so field initializers never run. Such a class keeps its state in GObject properties, or assigns it from `vfuncConstructed`.

## Next

Continue with [Components](/guide/components) for how GTKX widgets compose and the hooks that drive them.
