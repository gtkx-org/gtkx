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

The call also returns the class it registered. Nothing here needs the return value, and [Properties](#properties) is where it starts to matter.

## Properties

Pass `properties` to install GObject properties on the new type, keyed by the name JavaScript addresses each one by and valued with the `GObject.ParamSpec` describing it. `registerClass` hands the class back with those names in its type, so bind the call to a name instead of discarding it:

```ts
import { Object as GObject, ParamFlags, paramSpecInt } from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class SwatchBase extends GObject {
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

`Swatch` is a value and a type at once: the `const` is the registered class, and `InstanceType<typeof Swatch>` names its instances wherever a signature needs them.

Register a class *declaration*, the way the example does, rather than a class expression written inside the call. `const Swatch = registerClass(class Swatch extends GObject { … })` reads well and behaves identically until the project emits declaration files, where the anonymous class type fails to be written out:

```
error TS4094: Property 'vfuncConstructed' of exported anonymous class type may not be private or protected.
```

Every wrapper class carries protected vtable members, so any registered class expression that a `.d.ts` has to name hits this. A declaration has a name TypeScript can refer to, and emits cleanly.

Registering an abstract class hands back an abstract class. Its properties reach every concrete subclass, and `new` on the base stays the error it already was.

Each property gains prototype accessors that emit `notify` on write: one for the key as written, one for the key with its dashes turned into underscores, and one for the key in camelCase. So `swatch.red = 200` and `swatch.setProperty("red", value)` are interchangeable, and a native consumer such as `Gtk.PropertyExpression` reads the value without calling back into JavaScript.

Declare the field with `declare` rather than an initializer. The accessors live on the prototype, and a class field would shadow them on every instance. The `declare`d type is also the value type the property carries everywhere else: `properties` says which properties to install, and the class says what each one holds.

### The two names a property has

The key is the JavaScript name, read in camelCase however it is written: `dewPoint`, `dew_point` and `dew-point` all name the same member, all put `dewPoint` in the class's type, and all read and write the same storage. The ParamSpec carries the GObject name, which is that same name canonicalized: lowercase words joined by dashes.

```ts
class ReadingBase extends GObject {
    declare dewPoint: number;
}

const Reading = registerClass(ReadingBase, {
    typeName: "ExampleReading",
    properties: { dewPoint: paramSpecInt("dew-point", null, null, 0, 255, 0, ParamFlags.READWRITE) },
});
```

The two have to agree, and `registerClass` refuses the pair when they do not:

```
registerClass: ReadingBase keys the property 'dewPoint' to a GObject.ParamSpec named 'dewPoint',
which is the name GObject notifies under; name the ParamSpec 'dew-point'
```

The ParamSpec's name is what GObject emits `notify` with, so a ParamSpec named `dewPoint` notifies under `notify::dewPoint` while everything that addresses the property by its JavaScript name, `useProperty` and `useSignal` included, listens for `notify::dew-point`. Nothing would ever hear a change, which is why the mismatch is an error rather than a convention.

### Properties and the hooks

`useProperty` from `@gtkx/react` reads a property and re-renders the component when it changes. It takes the properties a registered class installs the same way it takes the ones a generated class arrives with, and you write nothing extra for it:

```tsx
import { GtkLabel } from "@gtkx/jsx/gtk";
import { useProperty, useSignal } from "@gtkx/react";

function SwatchRow({ swatch }: { swatch: Swatch }) {
    const red = useProperty(swatch, "red"); // number | undefined

    useSignal(swatch, "notify::red", () => {
        console.log("red is now", swatch.red);
    });

    return <GtkLabel label={`red: ${red ?? 0}`} />;
}
```

The names come off the class the call returned, which is why the example binds it to `Swatch` instead of dropping it. Registering as a bare statement installs the same properties at runtime and leaves the type with none to offer:

```ts
class Tint extends GObject {
    declare level: number;
}

registerClass(Tint, {
    typeName: "ExampleTint",
    properties: { level: paramSpecInt("level", null, null, 0, 255, 0, ParamFlags.READWRITE) },
});

useProperty(new Tint(), "level"); // Argument of type '"level"' is not assignable to parameter of type 'never'
```

Leave the `properties` object to inference for the same reason. Pulled out into a constant and annotated, its key type is `string`, which names no property in particular and leaves the class with none of them addressable. `satisfies`, with `ParamSpec` imported as a type from `@gtkx/gi/gobject`, keeps the keys and still checks the values:

```ts
const DIAL_PROPERTIES = {
    angle: paramSpecInt("angle", null, null, 0, 360, 0, ParamFlags.READWRITE),
} satisfies Record<string, ParamSpec>;
```

Only installed properties are addressable, and every other member of the class is rejected, because nothing notifies on it:

```ts
class DialBase extends GObject {
    declare angle: number;

    tally = 0;
}

const Dial = registerClass(DialBase, { typeName: "ExampleDial", properties: DIAL_PROPERTIES });

const dial = new Dial();

useProperty(dial, "angel"); // rejected: nothing installs that name
useProperty(dial, "tally"); // rejected: a plain field, not a property
useProperty(dial, "setProperty"); // rejected: a method, not a property
```

A subclass of a generated class keeps every property it inherits, so `useProperty` still takes `"label"` on a `Gtk.Label` subclass, beside the ones the subclass installs.

`useSignal` never needed any of this. Every GObject declares `notify`, so `"notify::red"` type-checks whichever form registered the class, and it is what `useProperty` connects to underneath.

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

Overrides of slots an interface declares work the same way, as long as the parent type already implements the interface. To adopt one it does not, see [Implementing an interface](#implementing-an-interface).

Those `vfunc` members are direct vtable invocations, and that is all they are. They exist so an override can chain up, which is why the ones a wrapper class declares are `protected`: `super.vfuncMeasure(...)` inside a subclass is allowed, `label.vfuncMeasure(...)` on a live instance is not. Slots an interface declares stay callable, because a TypeScript interface cannot carry a protected member; calling one runs the slot again on a live instance, which most slots do not expect.

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

## Implementing an interface

A subclass inherits the interfaces its parent implements. To adopt one the parent does not provide, name it in
`implements` and fill its vtable slots on the class:

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

`implements` takes the interface values themselves, `Gio.ListModel` rather than `"GListModel"`. The new GType
adds each one, and the `vfunc`-prefixed methods on the class become that interface's vtable. Nothing else
changes: class vtable slots, `properties` and the rest of `registerClass` behave as they do without it.

Naming an interface the parent already provides is allowed and changes nothing. The class keeps the parent's
implementation, and only the slots it actually overrides replace it.

### The `Impl` type

Every interface that has vtable slots comes with a companion type named after it: `Gio.ListModel` has
`Gio.ListModelImpl`, `Gtk.SelectionModel` has `Gtk.SelectionModelImpl`. It pins the signature of every slot the
class declares, so a slot written with the wrong parameters or return type fails to build. A misspelled slot
*name* does not: it reads as an ordinary method the type never asked about, and the slot stays unfilled.

Its members are optional, all of them. `implements Gio.ListModelImpl` pins the signature of every slot the class
declares and asks for none of the ones it does not, which is what `registerClass` does too: a slot left out
keeps whatever the interface installs by default. It also means an interface that grows a slot in a later GTK
release, out of the padding its vtable reserves, does not break a class written against the older one. The
slots come from the GIR on the machine that ran codegen, so that release arrives without a GTKX version change.

Because every member is optional, the clause needs at least one of them to mean anything: a class that writes
`implements Gio.ListModelImpl` and fills no slot at all is rejected as a weak type. Leave the clause off when
the class fills nothing, which is what the placeholder below does.

The interface's own methods, properties and signals are not part of it. Those come from GLib dispatch, not from
anything the class writes.

An interface built on another interface gets an `Impl` that extends it, because its implementer owes both sets
of slots: `Gtk.SectionModelImpl extends Gio.ListModelImpl`, `Gtk.SymbolicPaintableImpl extends
Gdk.PaintableImpl`. A prerequisite that is a *class* is a different requirement, one the class satisfies by
extending it, so it contributes no slots: `Gtk.Editable` requires `GtkWidget`, and `Gtk.EditableImpl` holds only
`Editable`'s own slots.

An interface with no slots to fill, `Gtk.Orientable` for instance, has no `Impl` type. Listing it in
`implements` is the whole job.

### Declare every slot as a method

Only the `vfunc`-prefixed methods on the class's prototype chain reach the vtable. A class field holding an
arrow function is assigned to each instance after the class exists, so it is not on a prototype and never
installs:

```ts
class Sectioned extends GObject implements Gtk.SectionModelImpl {
    vfuncGetSection = (): [number, number] => [1, 1]; // never reaches the vtable

    // ... vfuncGetItemType, vfuncGetNItems, vfuncGetItem
}
```

Nothing catches this. `registerClass` runs at class-definition time, when a field has left no trace on the class
or its prototype, and `implements Gtk.SectionModelImpl` accepts it because TypeScript takes a field wherever it
asks for a method. What the class gets is a slot still holding whatever the parent type or the interface
installed: `instance.vfuncGetSection()` answers with the field while GTK goes on calling the other one, or calls
through a null pointer and takes the process down with it.

The same applies to a slot the parent type already fills. `override vfuncGetSection = (...) => …` compiles
clean, and the two sides then disagree for the life of the object.

A misspelled slot name fails the same way and for the same reason. `vfuncGetSecton` is a method the `Impl` type
never asked about, so nothing rejects it, and the slot it was meant to fill is left to the interface:

```ts
class Sectioned extends GObject implements Gtk.SectionModelImpl {
    vfuncGetSecton(): [number, number] { // typo: compiles, never installs
        return [0, 1];
    }
}
```

Both cases end the same way, so check the spelling against the `Impl` type when a slot you wrote is never
called.

### Chaining up out of a slot you fill

`super.vfuncGetSection(...)` inside a slot the class fills reaches the implementation the interface installs by
default, which is exactly the one the class replaced. It is the same thing chaining up means for a slot an
ancestor already fills, and it never re-enters the method it is called from:

```ts
class Sectioned extends GObject implements Gtk.SectionModelImpl {
    vfuncGetSection(position: number): [number, number] {
        return super.vfuncGetSection(position); // GtkSectionModel's own default, [0, n_items]
    }

    // ... vfuncGetItemType, vfuncGetNItems, vfuncGetItem
}
```

An interface that installs nothing for the slot has nothing underneath, and the call says so:

```
Error during FFI call: ListModelInterface.get_item: interface 'GListModel' provides no implementation
```

TypeScript resolves `super.x` against the base class, which does not carry the interface until `registerClass`
splices it in. Name the base the class really ends up with to chain up:

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

`Omit<…, never>` keeps every static while dropping the base's own construct signature, so the class has a single
one and TypeScript accepts it as a base. A `declare`d member does not work here: TypeScript reads it as a class
field, and a field is not reachable through `super`.

Naming the spliced base makes every slot an override of a base member, so under `noImplicitOverride` all of them
need the `override` keyword, not only the one that chains up.

### Slots you leave to the interface

A slot no method fills is left exactly as GLib made it, holding whatever the interface installs by default, or
nothing at all. That is the same vtable a C implementation gets from `G_IMPLEMENT_INTERFACE` when its
`interface_init` leaves the slot alone, and the consequences are the same ones C has. Neither `Impl` nor
`registerClass` asks for more, so the choice of which slots to fill is yours to get right.

Most GLib and GTK entry points guard the slot for null and take a not-supported path, so leaving one out is
harmless:

```ts
class Placeholder extends GObject {}

registerClass(Placeholder, { typeName: "ExamplePlaceholder", implements: [Gio.File] });

const file = new Placeholder() as Gio.File;
file.querySettableAttributes(null); // an empty list, the way GFile answers for a file that has none
```

Some do not. `g_list_model_get_n_items()` calls the slot without checking it, so a class adopting
`Gio.ListModel` without filling all three of its slots crashes the moment something asks:

```ts
class Empty extends GObject {}

registerClass(Empty, { typeName: "ExampleEmpty", implements: [Gio.ListModel] });

(new Empty() as Gio.ListModel).getNItems(); // segmentation fault
```

Fill the slots. Nothing checks that you did: `Gio.ListModelImpl` accepts a class that declares one of the three,
because a slot left out is a decision GLib supports and a compiler cannot tell apart from an omission.

One case is worth naming because the defaults are real and still do not work on their own.
`Gtk.SelectionModel` ships defaults for `is_selected` and `get_selection_in_range` written in terms of each
other, so a class that adopts the interface and overrides neither recurses between them until the stack runs
out. A C implementation adopting `GTK_TYPE_SELECTION_MODEL` with a null `interface_init` blows the stack in
exactly the same place. Fill `vfuncIsSelected`, or `vfuncGetSelectionInRange`, or both.

### What instances gain

Registering with `implements` also splices the interface's members into the class's prototype chain, underneath
the class's own methods. Instances get the caller side of the interface and its signals without writing any of
it:

```ts
const store = new LevelStore();
store.rows.push(new GObject({}));
store.itemsChanged(0, 0, 1);

store.getNItems(); // 1
store.getItem(0) === store.rows[0]; // true
store instanceof Gio.ListModel; // true

store.connect("items-changed", (position, removed, added) => {
    console.log(position, removed, added);
});
```

TypeScript does not see the splice, because `Gio.ListModelImpl` describes only the slots. Name the combination
wherever the caller side matters:

```ts
type Level = Gio.ListModel & LevelStore;

const level = new LevelStore() as Level;
const selection = new Gtk.SingleSelection({ model: level });
```

Inside the class, `declare` the members it calls on itself:

```ts
class LevelStore extends GObject implements Gio.ListModelImpl {
    declare itemsChanged: Gio.ListModel["itemsChanged"];

    rows: GObject[] = [];

    setRows(rows: GObject[]): void {
        const removed = this.rows.length;
        this.rows = rows;
        this.itemsChanged(0, removed, rows.length);
    }

    // ...
}
```

`declare` emits no field, so the call still resolves down the prototype chain to the spliced-in member.

### Why not extend a class that already has it

`Gio.ListStore` implements `GListModel`, so extending it and overriding the three slots looks like a shortcut to
a custom list model. It is not one. The inherited GSequence is still there, still empty, and still the answer to
everything the subclass did not override:

```ts
class LevelStore extends Gio.ListStore {
    rows = [new GObject({}), new GObject({})];

    override vfuncGetNItems(): number {
        return this.rows.length;
    }

    // ... vfuncGetItemType, vfuncGetItem
}

const store = new LevelStore({ itemType: TYPE_OBJECT });

store.getNItems(); // 2, served by the vfunc
store.nItems; // 0, read off the empty GSequence
store.find(store.getItem(0)); // [false, 0]: find searches the sequence, which never sees a vfunc-served item

store.append(new GObject({}));
store.getNItems(); // still 2
store.nItems; // now 1
```

Every inherited method is a second source of truth that the overrides cannot reach, and `n-items` is a property
consumers are invited to bind to. `implements` gives the class the interface and no parent state to disagree
with it.

### Errors

An entry that is not a registered interface is rejected before anything is registered:

```
registerClass: LevelStore lists 'Label' in implements, which is not a registered interface
```

So is an interface whose prerequisites the parent type does not meet:

```
Error during register_class: register_class: parent type 'GObject' does not meet prerequisite 'GtkWidget' of interface 'GtkEditable'
```

`Gtk.Editable` requires a widget. Extend `Gtk.Widget`, or one of its subclasses, and the entry is accepted.

## Elements that cannot be children

Not every GObject in a render tree is a child of the element it sits inside, and the reconciler places a child only where a behavior on the parent claims it. Nothing claims the ones that are not children, so the placement fails loudly rather than being dropped:

```
<GtkAdjustment> cannot be a child of <GtkBox>. Pass it to the <GtkBox> prop that takes it, if there is one,
portal it to rootElement with createPortal if it does not belong inside <GtkBox>, or register an attach
behavior for <GtkBox> with defineElements from "@gtkx/react/config" if it belongs among its children.
```

The remedies are the things the nesting can mean.

Many containers place a widget in a named position through a prop rather than through their children: `<GtkPaned startChild={…} endChild={…}>`, `<GtkCenterBox startWidget={…} centerWidget={…} endWidget={…}>`, `<GtkHeaderBar start={…} end={…} titleWidget={…}>`. Nesting such a widget as a child leaves nothing to claim it, and passing it as the prop for the position it belongs in is the fix.

An object nested purely so it lives and dies with the component around it, rather than because it belongs to the parent's content, wants a portal. `createPortal(element, rootElement)` from `@gtkx/react` mounts it with no GTK4 parent while it stays where it is in the React tree, so it still reads the surrounding context and still unmounts with the component that rendered it. Putting the portal in a component that wraps the element keeps the natural shape at every call site:

```tsx
import { createPortal, rootElement } from "@gtkx/react";

function Grouped(props: GtkSizeGroupProps) {
    return createPortal(<GtkSizeGroup {...props} />, rootElement);
}
```

GTKX ships that wrapper for `GtkSizeGroup` itself, which is why the element can sit among the widgets it groups. [Modals and Portals](/guide/modals-and-portals) covers `rootElement` and the rest of the mounting model.

When the object really is a child, the parent is missing an `attach` behavior. Give it one with `defineElements`, keyed by the parent's GLib type name, as [Advanced: Customizing elements](/guide/configuration-and-codegen#advanced-customizing-elements) describes. A behavior declared on a type covers every element descending from it, so the one that fits usually belongs on an ancestor rather than on the parent alone.

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
