---
title: "Subclassing GObject"
description: "Register native types in TypeScript and render them through JSX."
---

# Subclassing GObject

Use React components to compose your interface. Register a subclass when a native API needs a new type, custom properties, or a virtual-function implementation. For background on the native object system, see the [GObject documentation](https://docs.gtk.org/gobject/concepts.html).

## Register a class

Extend a generated GI class and pass the class declaration to `registerClass`. Choose an application-specific `typeName`; native type names share a process-wide namespace.

```ts
import { ParamFlags, paramSpecString } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";

class TaggedScaleBase extends Gtk.Scale {
    declare tag: string;
}

const TaggedScale = registerClass(TaggedScaleBase, {
    typeName: "ExampleTaggedScale",
    properties: {
        tag: paramSpecString("tag", null, null, "", ParamFlags.READWRITE),
    },
});

type TaggedScale = InstanceType<typeof TaggedScale>;
```

Keep the returned class: it carries the registered properties and signals into TypeScript. Register once at module scope, before rendering instances. See the [`registerClass` reference](/v2/reference/@gtkx/runtime/functions/registerClass) for registration options.

## Rendering a registered class

Codegen does not emit elements for application-defined classes. Create an element with the registered type name and its props, then instantiate it through JSX:

```tsx
import { GtkAdjustment, type GtkScaleProps } from "@gtkx/jsx/gtk";
import { createElementComponent } from "@gtkx/react";

type TaggedScaleProps = GtkScaleProps<TaggedScale> & { tag?: string };
const TaggedScaleElement = createElementComponent<TaggedScaleProps>("ExampleTaggedScale", TaggedScale);

<TaggedScaleElement
    tag="volume"
    widthRequest={180}
    adjustment={<GtkAdjustment lower={0} upper={100} value={40} />}
/>;
```

The element inherits its parent type's props, signals and child-placement behavior. Passing the class also keeps its registration reachable in production bundles.

Declared native properties are passed into construction. Construct-only props must remain unchanged while the element is mounted. Omitting a writable prop on a later render restores its ParamSpec default.

## Properties

Use `declare` for native properties. A JavaScript field initializer would shadow the native accessor. Keep property maps inferred so their keys remain available to `useProperty` and other typed consumers.

Property keys use camelCase; the ParamSpec uses the matching native spelling. For example, pair `displayName` with `paramSpecString("display-name", ...)`. Declare read-only and construct-only fields as `readonly`.

Typed `GObject.getProperty` and `GObject.setProperty` calls infer keys from declared fields and compatible ParamSpecs. Use their descriptor-taking overloads when a spec cannot preserve that inference, such as a write-only property or a spec widened to plain `ParamSpec`.

### Overriding an inherited property

Use `paramSpecOverride("property-name", Source)` when explicitly redeclaring a property from a parent class or interface. `Source` can be its generated class, interface, or GType. Implemented interface properties are overridden automatically; an explicit spec is useful when supplying custom accessors.

### Inspecting a ParamSpec

Use the generated ParamSpec reference for its metadata and flags. Class-level inspection is available through generated class-struct wrappers, such as `GObject.ObjectClass.peek(TaggedScale)`.

### Properties and the hooks

Pass an instance or ref to `useProperty(ref, "tag")` to subscribe to a registered property. Inherited properties remain available. Keep application effects in React components and hooks.

## Declaring signals

The `signals` option registers custom signals. Each entry names its parameter GTypes and, when needed, its return GType. Use the returned class so GTKX's signal helpers recognize the declared names. Custom JSX components should include their signal handler props in their prop type.

Handlers receive the signal arguments; JSX handlers also receive the emitting object last. See the [JSX prop model](/v2/guide/configuration-and-codegen#the-jsx-prop-model) for consumption and the [`registerClass` reference](/v2/reference/@gtkx/runtime/functions/registerClass) for signal options.

## Default handlers

A class method named `on<SignalName>`, such as `onClicked`, becomes the default handler for that signal. It receives the signal arguments with `this` bound to the instance. A subclass can replace it and chain to the previous implementation with `super.onClicked()`.

Reserve these names for default handlers when they match a signal. Use ordinary React handler props for application behavior attached to a rendered element.

## Class-level setup

Use `classInit` for native operations that must run during type registration, and `cssName` to set a widget subclass's CSS name. `classInit` receives the generated class-struct wrapper, such as `Gtk.WidgetClass`, after GTKX installs the declared properties, signals and virtual functions.

This is type setup, not a component mount effect. If it throws, registration fails to return, but the native type remains registered and cannot be retried under the same name.

## Overriding virtual functions

Implement the generated `vfunc` method with its declared signature. Use `super` to chain to the parent implementation:

```ts
class PaddedLabel extends Gtk.Label {
    override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): [number, number, number, number] {
        const [minimum, natural, minimumBaseline, naturalBaseline] = super.vfuncMeasure(orientation, forSize);

        return [minimum + 10, natural + 10, minimumBaseline, naturalBaseline];
    }
}

registerClass(PaddedLabel, { typeName: "ExamplePaddedLabel" });
```

Output parameters become return values, grouped into a tuple when there are several. Follow the [native operation's contract](https://docs.gtk.org/gtk4/vfunc.Widget.measure.html) when changing those values. Invoke the ordinary public method when using an instance; direct vfunc calls are for chaining from an override.

### Slots with no generated member

Use [`callParent`](/v2/reference/@gtkx/runtime/functions/callParent) when the slot has no generated member, including `vfuncDispose`. Pass the class whose override is running, the vfunc name, the instance, and its arguments. The same helper can chain interface slots that TypeScript cannot resolve through `super`.

## Implementing an interface

List the generated interface value in `implements` and implement its required vfunc methods. The generated `Impl` type checks their signatures:

```ts
import * as Gio from "@gtkx/gi/gio";
import { Object, TYPE_OBJECT } from "@gtkx/gi/gobject";

class LevelStoreBase extends Object implements Gio.ListModelImpl {
    rows: Object[] = [];

    vfuncGetItemType(): bigint {
        return TYPE_OBJECT;
    }

    vfuncGetNItems(): number {
        return this.rows.length;
    }

    vfuncGetItem(position: number): Object | null {
        return this.rows[position] ?? null;
    }
}

const LevelStore = registerClass(LevelStoreBase, {
    typeName: "ExampleLevelStore",
    implements: [Gio.ListModel],
});
```

Write vfuncs as prototype methods, not arrow-function fields. The `Impl` type checks signatures; it does not establish that every required native operation has an implementation. Follow the interface's prerequisites and behavior contract. For this example, [Gio.ListModel](https://docs.gtk.org/gio/iface.ListModel.html) also requires change notifications when items change.

Registration adds the interface's public members to instances. Inside the class, declare any added member you call, such as `declare itemsChanged: Gio.ListModel["itemsChanged"];`. Use a base class whose native state agrees with the implementation you provide.

### Throwing out of a slot you fill

Throw from a vfunc that reports errors through `GError`. GTKX preserves a thrown `GLib.Error` and converts other exceptions into a native error. A slot without an error channel cannot report failure that way; see [Error Handling](/v2/guide/error-handling).

## Elements that cannot be children

Express native object relationships through JSX props and supported child slots. For an object that needs React ownership without native child placement, use [a portal](/v2/guide/modals-and-portals). Add native placement rules through [element configuration](/v2/guide/configuration-and-codegen#advanced-customizing-elements).

## What an override of `constructed` can see

`vfuncConstructed` runs after native construct properties are set, while `super()` is still executing. JavaScript field initializers and the constructor body have not run yet. Use declared fields or native properties for state this override needs; private fields are unavailable at that point.

Objects created by native code do not run the JavaScript constructor or its field initializers. Initialize state needed by those instances in `vfuncConstructed`, chaining to the parent. Keep ordinary component setup in React.

Continue with [Components](/v2/guide/components).
