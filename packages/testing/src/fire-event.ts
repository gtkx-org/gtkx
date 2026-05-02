import { type Object as GObject, signalEmitv, signalLookup, typeFromName, Value } from "@gtkx/ffi/gobject";
import type * as Gtk from "@gtkx/ffi/gtk";
import { tick } from "./timing.js";

/**
 * Emits a GTK signal on a widget or event controller.
 *
 * Low-level utility for triggering signals directly. Prefer {@link userEvent}
 * for common interactions like clicking and typing.
 *
 * @param element - The widget or event controller to emit the signal on
 * @param signalName - GTK signal name (e.g., "clicked", "activate", "drag-begin")
 * @param args - Additional signal arguments as GValues
 *
 * @example
 * ```tsx
 * import { fireEvent } from "@gtkx/testing";
 * import { Value } from "@gtkx/ffi/gobject";
 *
 * // Emit signal on widget
 * await fireEvent(widget, "clicked");
 *
 * // Emit signal on gesture controller
 * const gesture = widget.observeControllers().getObject(0) as Gtk.GestureDrag;
 * await fireEvent(gesture, "drag-begin", Value.newFromDouble(100), Value.newFromDouble(100));
 * ```
 *
 * @see {@link userEvent} for high-level user interactions
 */
export const fireEvent = async (
    element: Gtk.Widget | Gtk.EventController,
    signalName: string,
    ...args: Value[]
): Promise<void> => {
    const ctor = element.constructor as typeof GObject;
    const gtype = typeFromName(ctor.glibTypeName);
    const signalId = signalLookup(signalName, gtype);

    const instanceValue = Value.newFromObject(element as GObject);

    signalEmitv([instanceValue, ...args], signalId, 0);

    await tick();
};
