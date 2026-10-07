import { type AnyClass, wrapHandle } from "@gtkx/runtime";
import { peekTypeClass, registerClassOption } from "@gtkx/runtime/internal";
import { Widget, WidgetClass as GeneratedWidgetClass } from "../gtk.js";

registerClassOption("cssName", (klass, name) => {
    if (!(klass.prototype instanceof Widget)) {
        throw new TypeError("cssName requires a GtkWidget parent");
    }

    if (typeof name !== "string") {
        throw new TypeError("cssName must be a string");
    }

    return (handle) => {
        wrapHandle(handle, GeneratedWidgetClass).setCssName(name);
    };
});

const peek = (type: bigint | AnyClass): GeneratedWidgetClass =>
    peekTypeClass(type, Widget) as GeneratedWidgetClass;

/**
 * The class structure for the GtkWidget type, with a static `peek` that hands back the class
 * struct of any widget type so class-level introspection such as `getCssName` works outside a
 * `classInit` hook.
 */
export const WidgetClass: typeof GeneratedWidgetClass & {
    /**
     * Returns the class struct of a widget type, referencing the class so it exists even before
     * the type's first instance. The reference is deliberately never released: once created, a
     * class struct lives for the rest of the process.
     *
     * @param type GType to peek the class struct of, or a registered wrapper class of the type.
     * @returns the widget type's class struct
     * @throws when `type` is not a type deriving from `Gtk.Widget`
     */
    peek: typeof peek;
} = Object.assign(GeneratedWidgetClass, { peek });

/**
 * The class structure for the GtkWidget type.
 */
export type WidgetClass = GeneratedWidgetClass;
