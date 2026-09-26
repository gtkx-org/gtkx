---
title: "React Renderer"
description: "How GTKX reconciles React trees into native GObjects, routes children and props, handles signals, and manages application presentation."
---

# React Renderer

`@gtkx/react` is a custom React renderer for native GObjects. It translates React's host operations into object construction, property updates, signal connections, and container-specific child placement. Generated JSX supplies the typed component surface, and generated GI supplies the classes and methods the renderer uses.

The reconciler is configured in [`reconciler/host-config.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/reconciler/host-config.ts). It uses mutation mode with concurrent roots, Node timers, and microtasks. Persistence and hydration are disabled. GTK performs layout and painting after the renderer changes the native tree.

## Generated components and host elements

A generated component such as `GtkButton` is a typed factory around a host element whose name is a GType name, such as `GtkButton`. Its reference to the generated GI class retains that class's registration and metadata in a bundled application.

[`components/element.tsx`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/components/element.tsx) builds that host element. It examines props containing React elements and routes them through internal `gtkx:prop` elements. This turns a named prop containing JSX into a reconcilable subtree associated with a slot name, while ordinary `children` remain in the default slot.

The renderer distinguishes four node kinds in [`reconciler/node.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/reconciler/node.ts):

| Kind | Meaning |
| --- | --- |
| Element | A native GObject, its current props, handlers, child placements, and style resources. |
| Prop | A named slot and the children routed into it; it has no native object. |
| Lazy | A declaration for an object created by its parent, adopted after placement. |
| Text | Text content associated with a supported text host. |

Function components and React context providers are reconciled by React itself. They do not add GObjects. This is why a React tree and the widget tree visible in an inspector are related but have different shapes.

## Metadata and element behaviors

The renderer combines native type ancestry with generated property and signal metadata. [`reconciler/metadata.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/reconciler/metadata.ts) resolves property flags, construction requirements, defaults, signal names, configured user-event signals, and behaviors inherited from classes and interfaces. Metadata registered for custom classes joins that system and invalidates cached type information when it changes.

There are two complementary definitions for an element:

- [`element-config.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/element-config.ts) describes its generated surface: additional props, omitted native props, component wrappers, accepted child types, and parent-created instances. It can be imported during generation without loading native bindings.
- [`element-behaviors.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/element-behaviors.ts) registers native construction, specialized prop updates, and child placement operations.

Shared builders in [`reconciler/behaviors.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/reconciler/behaviors.ts) implement recurring attachment patterns such as a single child setter, ordered box children, and indexed collections. The registry combines these operations through type ancestry. Controlled values and layout effects use components and hooks instead of a separate host lifecycle.

## Construction and prop updates

When React creates an instance, [`reconciler/instance.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/reconciler/instance.ts) resolves its metadata, selects construction props, and either invokes the registered class constructor or an element-specific creation behavior. Lazy elements defer native object creation to their parent instead.

[`reconciler/apply-props.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/reconciler/apply-props.ts) then applies element behaviors, writes remaining values, connects handlers, and marks work that must finish at commit time. Behavior-consumed props are excluded from generic property assignment. React's `children`, `ref`, and `key` are reserved for their respective React and renderer roles.

On an update, unchanged values are skipped. Removing a prop can restore its recorded default. A construct-only native property cannot be changed on an existing instance; the renderer rejects that update, so an application must change the element's key when it needs a newly constructed object.

The host configuration's `resetAfterCommit` flushes text, accessibility, styles, and adopted object references after tree mutations. Adopted refs are available to parent layout effects. The element component handles accessibility reapplication on map through [`useAccessibleMap`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/hooks/use-accessible-map.ts), whose callback ref owns the signal connection and cleanup.

## Child placement and parent-created objects

GObject containers expose different APIs. A box has ordered children, an application owns windows, a menu owns items, and a named widget prop may hold exactly one child. GIR describes native types and methods, but the renderer's element behaviors supply the React attachment semantics.

[`child-routing.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/reconciler/child-routing.ts) routes changes according to the parent node kind and named slot. [`placement.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/reconciler/placement.ts) resolves the matching behavior, tracks actual placements, and performs attachment, removal, or reordering. Reordering may use a native reorder operation or a detach-and-attach path depending on the container.

Lazy nodes represent native objects a parent creates as a consequence of adding a child. Examples include stack pages, notebook pages, and layout-child objects. The node initially records props and children without constructing that object. Placement obtains the object from the parent, adopts it, and applies the lazy node's props and handlers to it. Changing the leaf child can require removing the old placement and adopting a different parent-created object.

This is also why adding a new supported container can involve both configuration and behavior. Correct prop declarations make the JSX legal to write; correct placement semantics make it function when mounted.

## Text, styles, and accessibility

Text nodes are accepted by specific content hosts, including labels and text buffers. They are not automatically turned into labels wherever a string appears. [`reconciler/text.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/reconciler/text.ts) tracks text content and supports text tags and child anchors, with targeted text updates where possible and a deferred flush when rebuilding a host's content is needed.

Styles and accessibility are also native operations. [`reconciler/style.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/reconciler/style.ts) manages renderer style resources, and [`utils/accessible-props.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/utils/accessible-props.ts) maps accessibility props to GTK's accessible API. A visible style or accessibility failure may arise after placement, so checking only initial prop assignment can miss the relevant path.

## Signals and controlled state

Handler props map to GObject signals using generated metadata or registered custom signal information. Property-specific notification handlers, such as `onNotifyText`, receive the current property value and the native object. Other signal handlers receive the signal arguments followed by the native object; the general `onNotify` handler therefore receives the parameter specification.

[`reconciler/signals.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/reconciler/signals.ts) keeps a handler record for each connected prop. If the signal and target object remain the same, a rerender replaces the stored JavaScript handler while retaining the existing native connection. Removing a handler prop disconnects it.

The wrapper dispatches handlers with React's discrete event priority. It also knows when the renderer is applying a property write or tree mutation. Configured user-event signals generated by those writes are suppressed; property notification suppression is matched to the property being written where possible. This prevents a controlled update from being mistaken for new user input while allowing the next real interaction to reach the latest handler.

Signal behavior changes should be checked through an actual interaction and through a prop-driven update, since those paths can emit the same native signal for different reasons.

Controlled selection and visibility use [`components/controlled.tsx`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/components/controlled.tsx) and its shared hook. These observe native changes and restore the latest committed prop when needed. Menu descriptions likewise compose JSX menu elements above the host layer.

## Collection models

The collection components render their selection model, `Gtk.FlattenListModel`, and collection root through JSX. [`use-collection.tsx`](https://github.com/gtkx-org/gtkx/blob/main/packages/components/src/internal/use-collection.tsx) binds their committed references to a JavaScript controller, then updates the collection index and native model together before applying controlled selection and expansion. Unmounting detaches the model graph and clears its groups.

The root implements `Gio.ListModel`. Its synchronous `get_item` callback supplies each section's model when GTK requests it, creating the level store and optional `Gtk.TreeListModel` at that point. Tree child models and row objects are likewise created only when native callbacks require an immediate return value. This keeps ordinary model ownership declarative while preserving the native callback construction exception.

## Roots, portals, and presentation

[`reconciler/root.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/reconciler/root.ts) creates roots, submits updates, tracks mounted roots, and exposes portals. The default root container is a marker with no native object. A root can also target an existing GObject, which the renderer adopts as a container. Portals let React children target another container while retaining their React ancestry.

Application, window, and dialog component wrappers add lifecycle above those host operations:

- The application component creates and starts an application, provides it through React context, and mounts its children after activation.
- Application windows associate with the current application and use presentation behavior appropriate to windows.
- Window and dialog wrappers manage presentation, parent-window relationships, close behavior, and their cleanup.

These wrappers live under [`packages/react/src/components`](https://github.com/gtkx-org/gtkx/tree/main/packages/react/src/components), supported by hooks such as `use-presented-instance` and `use-parent-window`. Read [Native Runtime](/contributing/native-runtime) for application registration and loop ownership, and [Modals and Portals](/v2/guide/modals-and-portals) for public composition patterns.

## Teardown and verification

React removal routes detachment through the placement system and removes subtree attachments before GTK unroots their widgets. This includes controllers, action groups, slots, and constraints. Deleted instances disconnect renderer handlers and release style resources; adopted instances disconnect their handlers too. The runtime still governs wrapper and native allocation lifetime, so unmounting and native finalization are separate events.

Renderer changes can be observed through [`@gtkx/testing`](https://github.com/gtkx-org/gtkx/tree/main/packages/testing), which renders React into the GTKX renderer and queries native widgets. The running development app also exposes its tree, interactions, and screenshots through the [GTKX MCP tools](/v2/guide/mcp). Use those native observations to confirm the behavior affected by a change: successful mounting, subsequent updates, removal, relevant edge cases, and invalid input where applicable.
