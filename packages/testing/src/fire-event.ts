import type * as GObject from "@gtkx/gi/gobject";
import { act } from "./timing.js";

/**
 * Emits a signal on any GObject — widgets, event controllers, selection models,
 * and other signal-emitting objects.
 *
 * Low-level utility for triggering signals directly. Prefer {@link userEvent}
 * for common interactions like clicking and typing.
 *
 * @param element - The GObject to emit the signal on
 * @param signalName - GTK signal name (e.g., "clicked", "activate", "drag-begin")
 * @param args - Signal arguments as plain JavaScript values; each is
 *   auto-marshalled to the signal's GIR-defined parameter type
 *
 * @example
 * ```tsx
 * import { fireEvent } from "@gtkx/testing";
 *
 * // Emit signal on widget
 * await fireEvent(widget, "clicked");
 *
 * // Emit signal on gesture controller
 * const gesture = widget.observeControllers().getObject(0) as Gtk.GestureDrag;
 * await fireEvent(gesture, "drag-begin", 100, 100);
 *
 * // Emit signal on a selection model
 * await fireEvent(listView.getModel(), "selection-changed", 0, 1);
 * ```
 *
 * @see {@link userEvent} for high-level user interactions
 */
export const fireEvent = async (element: GObject.Object, signalName: string, ...args: unknown[]): Promise<void> => {
    await act(() => {
        element.emit(signalName, ...args);
    });
};
