import { type GTyped, getWrapperClass, typeFromName } from "@gtkx/ffi";
import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import type { AnyClass } from "@gtkx/utils";
import { typeChainIncludes } from "./gtype.js";

export type { GTyped };

/**
 * Whether `instance`'s GType ancestry contains `typeName`.
 *
 * The lookup walks the live GType registry, so a namespace that has not been
 * loaded contributes no ancestry names and every guard over its types is
 * correctly `false`. This is how `@gtkx/react` recognizes optional-namespace
 * widgets (Adwaita, GtkSource) without importing those namespaces as values.
 *
 * @param instance - The backing GObject to test
 * @param typeName - GLib type name to search the ancestry for
 */
export const hasType = (instance: GTyped, typeName: string): boolean => typeChainIncludes(instance.__gtype__, typeName);

/**
 * Whether a registered class's GType ancestry contains `typeName`. The class
 * registry stamps each class prototype with its resolved GType, so the check
 * works without an instance — e.g. when classifying a JSX element type before
 * construction.
 *
 * @param cls - The registered backing class to test, or `null`
 * @param typeName - GLib type name to search the ancestry for
 */
export const classHasType = (cls: AnyClass<GTyped> | null, typeName: string): boolean =>
    cls !== null && typeChainIncludes(cls.prototype.__gtype__, typeName);

/**
 * The structural surface of an `Adw.Dialog` that `@gtkx/react` drives:
 * presenting against a parent widget and force-closing on unmount. Declared
 * structurally so the runtime never references the optional Adwaita
 * namespace, even at the type level.
 */
export interface AdwDialogLike extends GTyped {
    /** Presents the dialog against `parent`, or detached when `null`. */
    present(parent: Gtk.Widget | null): void;
    /** Closes the dialog unconditionally, bypassing close-attempt handling. */
    forceClose(): void;
}

/**
 * The structural surface of a dropdown-style list widget (`Gtk.DropDown` or
 * `Adw.ComboRow`) the list controller drives: the model, the three item
 * factories, and the selected-position accessors. Declared structurally so the
 * runtime never references the optional Adwaita namespace, even at the type
 * level, and so the two widgets — whose GObject hierarchies are disjoint —
 * share one type.
 */
export interface DropDownLike extends GTyped {
    /** Replaces the widget's item model. */
    setModel(model: Gio.ListModel | null): void;
    /** Replaces the factory rendering the selected item. */
    setFactory(factory: Gtk.ListItemFactory | null): void;
    /** Replaces the factory rendering the popup list's items. */
    setListFactory(factory: Gtk.ListItemFactory | null): void;
    /** Replaces the factory rendering the popup list's section headers. */
    setHeaderFactory(factory: Gtk.ListItemFactory | null): void;
    /** Selects the item at `position`. */
    setSelected(position: number): void;
    /** The selected item's position. */
    getSelected(): number;
}

/** Whether `instance` is an `AdwDialog`. */
export const isAdwDialog = <T extends GTyped>(instance: T): instance is T & AdwDialogLike =>
    hasType(instance, "AdwDialog");

/** Whether `instance` is an `AdwComboRow`, narrowing it to the dropdown surface. */
export const isAdwComboRow = <T extends GTyped>(instance: T): instance is T & DropDownLike =>
    hasType(instance, "AdwComboRow");

/**
 * Resolves the registered backing class for a GLib type name, or `null` when
 * none is registered. The single name→class resolver: the class registry stamps
 * `__gtype__` on every registered prototype, so the result safely backs a
 * {@link GTyped} instance.
 *
 * @param typeName - GLib type name, e.g. `"GtkBox"`
 */
export const resolveBackingClass = (typeName: string): AnyClass<GTyped> | null =>
    getWrapperClass(typeFromName(typeName)) as AnyClass<GTyped> | null;

/**
 * Resolves a registered GObject class by its GLib type name, throwing a clear
 * error when the class is not registered.
 *
 * A class is registered only once its namespace has been loaded, which happens
 * when the app imports the matching `@gtkx/jsx/<ns>` module. Optional
 * namespaces (Adwaita, GtkSource) are therefore constructed by name through this
 * helper, so `@gtkx/react` never imports them as values; an absent class means
 * the app used a feature that needs a namespace it did not import.
 *
 * @param typeName - GLib type name, e.g. `"GtkSourceBuffer"`
 * @throws {Error} when the class is not registered (its namespace was not imported)
 */
export const requireClassByName = (typeName: string): AnyClass => {
    const cls = resolveBackingClass(typeName);
    if (!cls) {
        throw new Error(
            `${typeName} is not registered. Import its @gtkx/jsx namespace module (e.g. \`import "@gtkx/jsx/adw"\`) before use.`,
        );
    }
    return cls;
};
