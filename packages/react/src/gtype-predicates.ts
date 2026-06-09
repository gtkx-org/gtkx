import { getNativeClassByName } from "@gtkx/ffi";
import type * as Adw from "@gtkx/gi/adw";
import type { GType } from "@gtkx/gi/gobject";
import type * as GtkSource from "@gtkx/gi/gtksource";
import type { AnyClass } from "@gtkx/utils";
import { collectTypeNameChain } from "./gtype.js";

/** The minimal shape every GObject instance carries: its resolved GLib type. */
type GTyped = { readonly __gtype__: GType };

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
export const hasType = (instance: GTyped, typeName: string): boolean =>
    collectTypeNameChain(instance.__gtype__).includes(typeName);

/** Whether `instance` is an `AdwDialog`. */
export const isAdwDialog = <T extends GTyped>(instance: T): instance is T & Adw.Dialog =>
    hasType(instance, "AdwDialog");

/** Whether `instance` is an `AdwViewStack`. */
export const isAdwViewStack = <T extends GTyped>(instance: T): instance is T & Adw.ViewStack =>
    hasType(instance, "AdwViewStack");

/** Whether `instance` is an `AdwToggleGroup`. */
export const isAdwToggleGroup = <T extends GTyped>(instance: T): instance is T & Adw.ToggleGroup =>
    hasType(instance, "AdwToggleGroup");

/** Whether `instance` is an `AdwAlertDialog`. */
export const isAdwAlertDialog = <T extends GTyped>(instance: T): instance is T & Adw.AlertDialog =>
    hasType(instance, "AdwAlertDialog");

/** Whether `instance` is an `AdwComboRow`. */
export const isAdwComboRow = <T extends GTyped>(instance: T): instance is T & Adw.ComboRow =>
    hasType(instance, "AdwComboRow");

/** Whether `instance` is a `GtkSourceBuffer`. */
export const isGtkSourceBuffer = <T extends GTyped>(instance: T): instance is T & GtkSource.Buffer =>
    hasType(instance, "GtkSourceBuffer");

/** Whether `instance` is a `GtkSourceView`. */
export const isGtkSourceView = <T extends GTyped>(instance: T): instance is T & GtkSource.View =>
    hasType(instance, "GtkSourceView");

/**
 * Resolves a registered GObject class by its GLib type name, throwing a clear
 * error when the class is not registered.
 *
 * A class is registered only once its namespace has been loaded, which happens
 * when the app imports the matching `@gtkx/react-gi/<ns>` module. Optional
 * namespaces (Adwaita, GtkSource) are therefore constructed by name through this
 * helper, so `@gtkx/react` never imports them as values; an absent class means
 * the app used a feature that needs a namespace it did not import.
 *
 * @param typeName - GLib type name, e.g. `"AdwTimedAnimation"`
 * @throws {Error} when the class is not registered (its namespace was not imported)
 */
export const requireClassByName = (typeName: string): AnyClass => {
    const cls = getNativeClassByName(typeName);
    if (!cls) {
        throw new Error(
            `${typeName} is not registered. Import its @gtkx/react-gi namespace module (e.g. \`import "@gtkx/react-gi/adw"\`) before use.`,
        );
    }
    return cls;
};
