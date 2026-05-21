import type * as Gtk from "@gtkx/ffi/gtk";
import { act } from "./timing.js";

/**
 * Emits a GTK signal on a widget or event controller.
 *
 * Low-level utility for triggering signals directly. Prefer {@link userEvent}
 * for common interactions like clicking and typing.
 *
 * @param element - The widget or event controller to emit the signal on
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
 * ```
 *
 * @see {@link userEvent} for high-level user interactions
 */
export const fireEvent = (
    element: Gtk.Widget | Gtk.EventController,
    signalName: string,
    ...args: unknown[]
): Promise<void> =>
    act(() => {
        element.emit(signalName, ...args);
    });
