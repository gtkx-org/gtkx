---
title: "Subclassing GObject"
description: "Turning a TypeScript class into a new GType with registerClass: properties, virtual function overrides, chaining up, and what an override of constructed can see."
---

# Subclassing GObject

JSX never needs a subclass. You reach for one when something outside the render tree has to be a GObject in its own right: a list model backing a `GtkListView`, a widget that controls its own measuring, or a type you name in a `GtkBuilder` file.

`registerClass` from `@gtkx/runtime` registers such a class as a new GType. It must extend a generated wrapper class, directly or through subclasses of your own. `typeName` defaults to the class's name, and GType names share one process-wide namespace, so prefix yours with something specific to the app. Whichever way it arrives, the name has to be one GType accepts — at least three characters, starting with a letter or underscore, the rest letters, digits, `-`, `_` or `+` — and any other name throws.

```ts
import { Object as GObject } from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class Counter extends GObject {}

registerClass(Counter, { typeName: "ExampleCounter" });
```

## Abstract types

`abstract: true` registers the type the way `G_TYPE_FLAG_ABSTRACT` marks a C type: it serves only as a base. Registered subclasses instantiate as usual and inherit its vfunc overrides, but constructing the class itself throws, whether from JavaScript or from a native caller.

```ts
class Shape extends GObject {}
registerClass(Shape, { typeName: "ExampleShape", abstract: true });

class Circle extends Shape {}
registerClass(Circle, { typeName: "ExampleCircle" });

new Circle(); // fine
new Shape(); // throws
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

The descriptor-free `GObject.getObjectProperty` and `GObject.setObjectProperty` helpers infer registered property types from these declarations too. The class declaration is their typing contract; the ParamSpec flags remain authoritative at runtime. This inference is deliberately conservative: it follows direct results from ParamSpec constructors whose GValue representation preserves the declared JavaScript shape, or `paramSpecOverride` when a typed class or interface source exposes the property through the same helpers. A spec widened to plain `ParamSpec`, a raw-GType override, and `paramSpecPointer`, `paramSpecUnichar` or arbitrary `paramSpecBoxed` specs still install normally but add no inferred helper key; use a descriptor-taking overload for them. Declare a read-only or construct-only field as `readonly` so the inferred setter does not accept it. For a write-only property, omit the field and use the descriptor-taking `setObjectProperty` overload: TypeScript treats a setter-only accessor as readable, so it cannot safely express that direction. If a registered property deliberately shares a name with a method, the method remains the ordinary JavaScript member and the inferred helpers omit the ambiguous name; use their descriptor-taking overloads when the native property is also needed.

A key is read in camelCase however it is written, so `dewPoint`, `dew_point` and `dew-point` name the same member. Its ParamSpec has to carry the canonical spelling, lowercase words joined by dashes: `paramSpecInt("dew-point", …)` under a `dewPoint` key. That is the name GObject emits `notify` under, and `registerClass` throws on a mismatch.

### Overriding an inherited property

`paramSpecOverride` redeclares a property a parent class or an implemented interface already carries, the way `g_param_spec_override` does in C. Installing the spec it returns gives the subclass its own storage and `notify` emission for the property, while the value type, flags and default stay the ones the overridden spec declares:

```ts
import { paramSpecOverride } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";

class TrackedRevealerBase extends Gtk.Widget {
    declare visible: boolean;
}

const TrackedRevealer = registerClass(TrackedRevealerBase, {
    typeName: "ExampleTrackedRevealer",
    properties: { visible: paramSpecOverride("visible", Gtk.Widget) },
});
```

The second argument names where the property comes from: a wrapper class, an interface, or a raw GType. It works the same for an interface property the class redeclares explicitly — `paramSpecOverride("orientation", Gtk.Orientable)` under an `orientation` key on a class that lists `Gtk.Orientable` in `implements` — though interface properties are overridden automatically, so reach for the explicit spelling only to pick the property's id or pair it with your own accessors. The call throws when the source declares no property under the given name.

### Inspecting a ParamSpec

Every `GObject.ParamSpec` — one built with a `paramSpec*` constructor, one a `notify` handler receives, or one `listProperties` and `findProperty` return — carries readonly getters describing the property it stands for. `name`, `nick` and `blurb` return what `getName`, `getNick` and `getBlurb` return; `flags` is the `ParamFlags` bitfield the spec was created with, so a mask like `spec.flags & ParamFlags.CONSTRUCT_ONLY` tells a construct-only property apart; `valueType` is the GType of the values the property holds; and `ownerType` is the GType the spec is installed on — `TYPE_INVALID` until it is installed on one.

```ts
class Inspector extends Gtk.Label {}

registerClass(Inspector, {
    typeName: "ExampleInspector",
    classInit: (typeStruct: GObject.ObjectClass) => {
        for (const spec of typeStruct.listProperties()) {
            console.log(spec.name, spec.flags, spec.valueType, spec.ownerType);
        }
    },
});
```

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

## Declaring signals

`signals` creates GObject signals on the new type, keyed by signal name. Each one names the GTypes of its arguments, either as the numeric GType or as a class carrying one, and instances connect and emit by name the same way they do an inherited signal:

```ts
import { Object as GObject, SignalFlags } from "@gtkx/gi/gobject";
import { registerClass, TYPE_INT, TYPE_STRING } from "@gtkx/runtime";

class DownloaderBase extends GObject {}

const Downloader = registerClass(DownloaderBase, {
    typeName: "ExampleDownloader",
    signals: {
        "progress-changed": { paramTypes: [TYPE_STRING, TYPE_INT] },
        finished: { flags: SignalFlags.RUN_LAST },
    },
});

const downloader = new Downloader();
downloader.connect("progress-changed", (url: string, percent: number) => console.log(url, percent));
downloader.emit("progress-changed", "https://example.com", 40);
```

As with properties, bind the call to a name: the declared names reach `connect` and `emit` in the type system only through what `registerClass` returns. Every part of a spec is optional, so `{}` declares a signal with no arguments and no return value that runs its handlers in the default `RUN_FIRST` stage. Either word separator spells the same signal, `progress_changed` and `progress-changed` both reaching the one above, and `on`, `once` and `off` take the declared names the way `connect` does, as does `useSignal` from `@gtkx/react`. A handler receives the emission's arguments without the leading emitter, matching a generated signal. `emit` takes exactly one argument per declared parameter, throwing for any other count, and converts each argument into a `GValue` of the declared GType, throwing for a value that type cannot hold.

A signal that returns a value declares `returnType`, and what a handler returns becomes the emission's result. `accumulator` picks one of the combiners GObject ships: `"first-wins"` stops the emission at the first handler and keeps its result, and `"true-handled"` runs handlers until one returns `true`, which requires a boolean `returnType`:

```ts
import { registerClass, TYPE_BOOLEAN } from "@gtkx/runtime";

class GuardBase extends GObject {}

const Guard = registerClass(GuardBase, {
    typeName: "ExampleGuard",
    signals: { "close-request": { returnType: TYPE_BOOLEAN, accumulator: "true-handled" } },
});

const guard = new Guard();
guard.connect("close-request", () => false);
guard.connect("close-request", () => true); // stops the emission
guard.emit("close-request"); // true
```

`SignalFlags.DETAILED` lets handlers connect to and emissions carry a `::detail` suffix, so `alert::red` reaches the handlers on that detail plus the ones on plain `alert`.

`registerClass` throws for a name that is not a valid signal name, a name the parent type or a listed interface already carries, the same name declared under both spellings, a GType that cannot hold a value, and an accumulator that is neither `"first-wins"` nor `"true-handled"`.

## Default handlers

A method named `on<SignalName>` — the signal's name in camelCase after the `on`, so `onClicked` for `clicked` and `onProgressChanged` for `progress-changed` — becomes that signal's default handler, whether an ancestor type or an implemented interface brings the signal or the same call declares it under `signals`:

```ts
class LoggingDownloaderBase extends GObject {
    onProgressChanged(url: string, percent: number): void {
        console.log(url, percent);
    }
}

const LoggingDownloader = registerClass(LoggingDownloaderBase, {
    typeName: "ExampleLoggingDownloader",
    signals: { "progress-changed": { paramTypes: [TYPE_STRING, TYPE_INT] } },
});

new LoggingDownloader().emit("progress-changed", "https://example.com", 40); // logs
```

The method is installed as a class-closure override, the way GJS installs `on_`-prefixed methods, so it runs on every emission, on the instances a native caller creates included, in the stage the signal's flags name rather than alongside connected handlers: a `RUN_FIRST` signal runs it before them, a `RUN_LAST` one after. It receives the emission's arguments without the leading emitter, with `this` bound to the emitter, and what it returns becomes the emission's result when the signal declares one. A subclass registering its own `on<SignalName>` replaces the handler for its instances, and `super.on<SignalName>()` reaches the replaced one. An `on`-prefixed method naming no signal the type carries is left alone as the ordinary method it is, so a helper like `onFrobnicate` stays a plain method.

::: warning
The promotion applies to every `on<SignalName>` method, including one written before default handlers existed: a helper such as `onShow` on a widget subclass names the inherited `show` signal, so registering the class now runs it on every `show` emission. Rename such a helper if it is not meant to be the signal's default handler.
:::

## Class-level setup

Some setup belongs to the type rather than to any instance. `cssName` and `classInit` cover it.

`cssName` names what instances of a widget subclass match in CSS, the way `gtk_widget_class_set_css_name` does in C. It is applied from inside the type's `class_init`, so every instance is born with it, whether JavaScript or a native caller such as `GtkBuilder` creates it. It requires the class to extend `Gtk.Widget`; registering a non-widget with a `cssName` throws.

`classInit` is a hook run once, synchronously, while `registerClass` registers the type. It receives the new type's class struct wrapped in its generated GTypeStruct wrapper, which is where class-level calls like `Gtk.WidgetClass.installAction`, `Gtk.WidgetClass.addShortcut` and `Gtk.WidgetClass.setLayoutManagerType` land:

```ts
import { getClassType, registerClass } from "@gtkx/runtime";
import * as Gtk from "@gtkx/gi/gtk";

class CardWidget extends Gtk.Widget {}

registerClass(CardWidget, {
    typeName: "ExampleCardWidget",
    cssName: "card",
    classInit: (typeStruct: Gtk.WidgetClass) => {
        typeStruct.installAction("card.flip", null, (widget) => {
            console.log("flipping", widget);
        });
        typeStruct.setLayoutManagerType(getClassType(Gtk.BoxLayout));
    },
});
```

The wrapper serves the members of every class struct in the parent chain on one object: a widget subclass sees `Gtk.WidgetClass` and `GObject.ObjectClass` members alike, so annotate the parameter as whichever of those types the hook needs — a non-widget subclass would take `GObject.ObjectClass` and reach `findProperty` or `listProperties`. The hook runs after `class_init` has installed the vfuncs, properties and signals declared in the same call, so they are already visible there. An exception it throws propagates out of `registerClass`, though the type itself stays registered: GObject has no way to unregister a static type.

Outside registration, the same class-level surface is reachable through the `peek` static on the generated GTypeStruct wrappers: `GObject.ObjectClass.peek` accepts any GObject type — a wrapper class or a raw GType — and hands back its class struct, and `Gtk.WidgetClass.peek` does the same for types deriving from `Gtk.Widget`, throwing for anything else. Peeking references the class so it exists even before the type's first instance, and the reference is deliberately never released, matching the process-long lifetime of a class struct. Reserve it for reads and other calls that are safe outside `class_init`, such as introspection:

```ts
import { ObjectClass } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";

ObjectClass.peek(Gtk.Label).findProperty("label"); // the ParamSpec of Gtk.Label's label property
ObjectClass.peek(Gtk.Label).listProperties(); // every ParamSpec the type carries
Gtk.WidgetClass.peek(Gtk.Button).getCssName(); // "button"
```

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

A slot whose C signature ends with a `GError**`, such as `Gio.Initable`'s `vfuncInit`, reports failure by throwing. A thrown `GLib.Error` reaches the C caller with its domain, code and message intact, and any other thrown value becomes a GError in a GTKX-owned domain carrying the value's message, while the slot returns its failure value (`false`, `null` or `0`). A caller that reads the error back out through a binding, `Gio.Initable.init()` for instance, receives it as a thrown `GLib.Error` again, so [Error Handling](/v2/guide/error-handling) applies end to end. A slot without that `GError**` has no channel to deliver an exception through, so throwing from one raises the exception as uncaught instead: see [Failures nothing can throw](/v2/guide/error-handling#failures-nothing-can-throw).

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

The reconciler places a child only where a behavior on the parent claims it, so nesting a GObject inside an element that does not claim it throws rather than dropping it. The error it throws names the remedies, one per nesting: pass the object to the parent prop that takes it, such as `<GtkPaned startChild={…}>`; portal it to `rootElement` with `createPortal` when it is nested only so it lives and dies with the component around it, which [Modals and Portals](/v2/guide/modals-and-portals) covers; or register an `attach` behavior for the parent, or an ancestor type, with `defineElements`, as [Advanced: Customizing elements](/v2/guide/configuration-and-codegen#advanced-customizing-elements) describes. GTKX ships that portal wrapper for `GtkSizeGroup` itself, which is why the element can sit among the widgets it groups.

## Rendering a registered class

A class `registerClass` created has no generated element. `createElementComponent` from `@gtkx/react/config` builds one for any GType name, here for the `Swatch` registered above:

```tsx
import type { GtkWidgetProps } from "@gtkx/jsx/gtk";
import { createElementComponent } from "@gtkx/react/config";

type SwatchProps = GtkWidgetProps<Swatch> & { red?: number };

const SwatchElement = createElementComponent<SwatchProps>("ExampleSwatch");

<SwatchElement red={200} widthRequest={48} />;
```

The element name is the `typeName` the class was registered under, and the element inherits the props, signal handlers, defaults and behaviors of every ancestor type, so a `Gtk.Widget` subclass takes `cssClasses`, `style`, `halign` and `onNotifyVisible` already. Name the props as the type argument, since a component left at the default accepts no attributes at all.

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

Continue with [Components](/v2/guide/components) for how GTKX widgets compose and the hooks that drive them.
