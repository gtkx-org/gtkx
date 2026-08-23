import type * as GObject from "@gtkx/gi/gobject";

/** The props of a host element or node, as React passes them through the reconciler. */
type Props = Record<string, unknown>;

/** Per-child values a slot hook receives while placing or moving one child. */
type PlaceInfo = {
    /** Name of the slot being filled: `children`, or the prop the child was nested under. */
    slot: string;
    /** Position of the child among the slot's children. */
    index: number;
    /** Object of the preceding child in the slot, or null when the child comes first. */
    sibling: GObject.Object | null;
    /** Object adopted for this child by an earlier attach, or null before it has one. */
    adopted: GObject.Object | null;
    /** Props of the child element. */
    props: Props;
    /** Value `initialize` returned for this behavior on the parent. */
    context: unknown;
};

/** Per-child values a slot hook receives while removing one child. */
type DetachInfo = {
    /** Name of the slot the child is leaving. */
    slot: string;
    /** Object the container adopted for this child, or null when it adopted none. */
    adopted: GObject.Object | null;
    /** Props of the child element. */
    props: Props;
    /** Value `initialize` returned for this behavior on the parent. */
    context: unknown;
};

/**
 * Customizes how one element type places children and applies props. Hooks other than `create` receive the
 * GObject instance; `update` and `flush` also take the private per-node context `initialize` built, and
 * `attach`, `reorder` and `detach` read it off their info object. Subtypes inherit a type's behaviors,
 * except for `create`, which is consulted only for the type it is registered on.
 */
type ElementBehavior<T extends GObject.Object = GObject.Object> = {
    /** Builds the GObject from its construct props, for types whose constructor does more than set properties. */
    create?: (props: Props) => GObject.Object;
    /** Builds the private per-node context the other hooks receive, once per node. */
    initialize?: (object: T) => unknown;
    /** Places a child, claiming it by returning anything other than `undefined`. */
    attach?: (object: T, child: GObject.Object, info: PlaceInfo) => unknown;
    /** Moves an already-attached child; without it, the whole slot is detached and re-attached in order. */
    reorder?: (object: T, child: GObject.Object, info: PlaceInfo) => unknown;
    /** Removes a child this behavior attached. */
    detach?: (object: T, child: GObject.Object, info: DetachInfo) => void;
    /** Returns the object the container adopts for a child, overriding whatever `attach` returned. */
    resolve?: (object: T, child: GObject.Object) => GObject.Object | null;
    /** Applies changed props and returns the names it consumed, which are then not set as GObject properties. */
    update?: (object: T, prev: Props, next: Props, context: unknown) => Iterable<string> | undefined;
    /** Runs after the commit that touched the node, once every child has been placed. */
    flush?: (object: T, context: unknown) => void;
    /** Releases whatever `initialize` or a later hook acquired, once the node is destroyed. */
    teardown?: (object: T, context: unknown) => void;
    /** Props to withhold from the constructor, leaving them for a later hook to apply. */
    deferred?: string[];
    /**
     * Props the behavior can only apply while the element is being built, because the library exposes no
     * counterpart to whatever applied them. Changing one after it has been applied throws instead of
     * silently applying the new value on top of the old.
     */
    constructOnly?: string[];
};

/** A named export in a module, referenced as plain data (the module is never imported at runtime). */
type ModuleExport = {
    /** Specifier the export is imported from. */
    module: string;
    /** Identifier the module exports it under. */
    export: string;
};

/**
 * How one GLib type is rendered. `component`, `props` and `omittedProps` are inert at runtime; they are
 * read only by codegen.
 */
type ElementConfig<T extends GObject.Object = GObject.Object> = {
    /** The element has no GObject of its own; its parent container creates one, as it does for pages. */
    isLazy?: boolean;
    /** Behaviors bound to the type, consulted in registration order and inherited by its subtypes. */
    behaviors?: ElementBehavior<T>[];
    /** Component that wraps the generated element. */
    component?: ModuleExport;
    /** Base props interface the generated props extend. */
    props?: ModuleExport;
    /** GObject properties to leave out of the generated props, such as those a behavior writes from children. */
    omittedProps?: string[];
};

/**
 * Every registered element config, keyed by GLib type name. Adwaita entries appear once `@gtkx/react/adw`
 * is loaded.
 */
const ELEMENTS: Record<string, ElementConfig> = {};

const deferredProps = (behavior: ElementBehavior): string[] => behavior.deferred ?? [];

const mergeBehaviors = (base: ElementConfig, added: ElementBehavior[], isPrepended: boolean): ElementBehavior[] => {
    const baseBehaviors = base.behaviors ?? [];

    return isPrepended ? [...added, ...baseBehaviors] : [...baseBehaviors, ...added];
};

const mergeConfigEntry = (base: ElementConfig, added: ElementConfig<never>, isPrepended = false): ElementConfig => {
    const { behaviors, isLazy, omittedProps, ...rest } = added;
    const entry: ElementConfig = { ...base, ...rest };

    if (behaviors !== undefined) {
        entry.behaviors = mergeBehaviors(base, behaviors as ElementBehavior[], isPrepended);
    }

    if (omittedProps !== undefined) {
        entry.omittedProps = [...(base.omittedProps ?? []), ...omittedProps];
    }

    if (isLazy === true) {
        entry.isLazy = true;
    }

    return entry;
};

/**
 * Merges maps of {@link ElementConfig} keyed by GLib type name into one, concatenating each type's
 * behaviors and omitted props in the order the maps are given (an earlier map's behaviors come first),
 * taking the last component and props seen, and marking a type lazy if any map does. Use it to combine
 * an app's element config with its behaviors.
 */
const mergeElementConfigs = (...maps: Record<string, ElementConfig<never>>[]): Record<string, ElementConfig> => {
    const merged: Record<string, ElementConfig> = {};

    for (const map of maps) {
        for (const [type, config] of Object.entries(map)) {
            merged[type] = mergeConfigEntry(merged[type] ?? {}, config);
        }
    }

    return merged;
};

const registerElements = (
    map: Record<string, ElementConfig<never>>,
    options: { isPrepended?: boolean } = {},
): void => {
    for (const [type, config] of Object.entries(map)) {
        ELEMENTS[type] = mergeConfigEntry(ELEMENTS[type] ?? {}, config, options.isPrepended === true);
    }
};

/**
 * Identity helper that types the module named by `elements.behaviors` in `gtkx.config.ts`, enabling
 * editor autocompletion and type checking. Key each entry by GLib type name and write each behavior
 * with {@link defineBehavior} so its hooks receive the concrete GObject class.
 */
const defineElements = (elements: Record<string, ElementConfig<never>>): Record<string, ElementConfig<never>> =>
    elements;

/**
 * Types one behavior against the GObject class it applies to, so every hook's object parameter is
 * inferred rather than annotated by hand. Pass the class as the type argument.
 *
 * ```ts
 * defineElements({
 *     GtkFrame: { behaviors: [defineBehavior<Gtk.Frame>({ attach: (frame, child) => frame.setChild(child) })] },
 * });
 * ```
 */
const defineBehavior = <T extends GObject.Object>(hooks: ElementBehavior<T>): ElementBehavior<never> => hooks;

const forTypes = (types: string[], config: ElementConfig<never>): Record<string, ElementConfig<never>> =>
    Object.fromEntries(types.map((type) => [type, config]));

const internal = (name: string): ModuleExport => ({ module: "@gtkx/react/internal", export: name });

export {
    ELEMENTS,
    deferredProps,
    mergeElementConfigs,
    registerElements,
    defineElements,
    defineBehavior,
    forTypes,
    internal,
    type Props,
    type PlaceInfo,
    type DetachInfo,
    type ElementBehavior,
    type ModuleExport,
    type ElementConfig,
};
