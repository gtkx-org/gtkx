import type * as GObject from "@gtkx/gi/gobject";

/** The props of a host element or node, as React passes them through the reconciler. */
type Props = Record<string, unknown>;

/** Per-child values a slot hook receives while placing or moving one child. */
type PlaceInfo = {
    slot: string;
    index: number;
    sibling: GObject.Object | null;
    adopted: GObject.Object | null;
    props: Props;
    context: unknown;
};

/** Per-child values a slot hook receives while removing one child. */
type DetachInfo = {
    slot: string;
    adopted: GObject.Object | null;
    props: Props;
    context: unknown;
};

/**
 * Customizes how one element type places children and applies props. Every hook receives the
 * GObject instance and a private per-node `context` built once by `createContext`. A slot hook
 * claims a child by returning a non-`undefined` value; that value, or `resolve`, is the object
 * the container adopts for the child. `update` returns the prop names it consumed so those props
 * are not also set as plain GObject properties.
 */
type ElementBehavior<T extends GObject.Object = GObject.Object> = {
    createContext?: (object: T) => unknown;
    attach?: (object: T, child: GObject.Object, info: PlaceInfo) => unknown;
    reorder?: (object: T, child: GObject.Object, info: PlaceInfo) => unknown;
    detach?: (object: T, child: GObject.Object, info: DetachInfo) => void;
    resolve?: (object: T, child: GObject.Object) => GObject.Object | null;
    update?: (object: T, prev: Props, next: Props, context: unknown) => Iterable<string> | undefined;
    flush?: (object: T, context: unknown) => void;
    mount?: (object: T, context: unknown) => void;
    unmount?: (object: T, context: unknown) => void;
    deferred?: string[];
};

/** A named export in a module, referenced as plain data (the module is never imported at runtime). */
type ModuleExport = { module: string; export: string };

/**
 * Per-element configuration keyed by GLib type name: whether the element is lazy (its GObject is
 * created by its parent container, as pages and layout children are), the custom behaviors bound to
 * its type, an optional component that wraps the generated element, and the base props interface its
 * generated props extend. `component` and `props` are inert at runtime; they are read only by codegen.
 */
type ElementConfig<T extends GObject.Object = GObject.Object> = {
    lazy?: boolean;
    behaviors?: ElementBehavior<T>[];
    component?: ModuleExport;
    props?: ModuleExport;
};

/**
 * Every registered element config, keyed by GLib type name. Adwaita entries appear once `@gtkx/react/adw`
 * is loaded.
 */
const ELEMENTS: Record<string, ElementConfig> = {};

/** Props a behavior applies after construction; the constructor is never given them. */
const deferredProps = (behavior: ElementBehavior): string[] => behavior.deferred ?? [];

const mergeBehaviors = (base: ElementConfig, added: ElementBehavior[], isPrepended: boolean): ElementBehavior[] => {
    const baseBehaviors = base.behaviors ?? [];

    return isPrepended ? [...added, ...baseBehaviors] : [...baseBehaviors, ...added];
};

const mergeConfigEntry = (base: ElementConfig, added: ElementConfig<never>, isPrepended = false): ElementConfig => {
    const entry: ElementConfig = { ...base };

    if (added.behaviors !== undefined) {
        entry.behaviors = mergeBehaviors(entry, added.behaviors as ElementBehavior[], isPrepended);
    }

    if (added.lazy === true) {
        entry.lazy = true;
    }

    if (added.component !== undefined) {
        entry.component = added.component;
    }

    if (added.props !== undefined) {
        entry.props = added.props;
    }

    return entry;
};

/**
 * Merges maps of {@link ElementConfig} keyed by GLib type name into one, concatenating each type's
 * behaviors in the order the maps are given (an earlier map's behaviors come first) and taking the last
 * lazy flag, component, and props seen. Use it to combine an app's element config with its behaviors.
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

/**
 * Registers a map of {@link ElementConfig} keyed by GLib type name, merging each entry into the
 * registry. Behaviors are appended by default (the framework's built-ins register this way); pass
 * `{ prepend: true }` for an app's own configuration so its behaviors are consulted before the
 * built-ins for the same slot, letting it override them regardless of registration order.
 */
const registerElements = (
    map: Record<string, ElementConfig<never>>,
    options: { prepend?: boolean } = {},
): void => {
    for (const [type, config] of Object.entries(map)) {
        ELEMENTS[type] = mergeConfigEntry(ELEMENTS[type] ?? {}, config, options.prepend === true);
    }
};

/**
 * Identity helper that types the module named by the `elements` entry of `gtkx.config.ts`, enabling
 * editor autocompletion and type checking. Key each entry by GLib type name and annotate each hook's
 * object parameter with the concrete GObject class the behavior applies to.
 */
const defineElements = (elements: Record<string, ElementConfig<never>>): Record<string, ElementConfig<never>> =>
    elements;

/** Spreads one config across many GLib type names. */
const forTypes = (types: string[], config: ElementConfig<never>): Record<string, ElementConfig<never>> =>
    Object.fromEntries(types.map((type) => [type, config]));

/** References a base props interface exported from `@gtkx/react/internal`. */
const internal = (name: string): ModuleExport => ({ module: "@gtkx/react/internal", export: name });

export {
    ELEMENTS,
    deferredProps,
    mergeElementConfigs,
    registerElements,
    defineElements,
    forTypes,
    internal,
    type Props,
    type PlaceInfo,
    type DetachInfo,
    type ElementBehavior,
    type ModuleExport,
    type ElementConfig,
};
