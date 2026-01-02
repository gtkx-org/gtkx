import type * as Gtk from "@gtkx/ffi/gtk";
import type { Arg } from "@gtkx/native";
import { call } from "@gtkx/native";
import { tick } from "./timing.js";

/**
 * Emits a GTK signal on a widget.
 *
 * Low-level utility for triggering signals directly. Prefer {@link userEvent}
 * for common interactions like clicking and typing.
 *
 * @param element - The widget to emit the signal on
 * @param signalName - GTK signal name (e.g., "clicked", "activate")
 * @param args - Additional signal arguments
 *
 * @example
 * ```tsx
 * import { fireEvent } from "@gtkx/testing";
 *
 * // Emit custom signal
 * await fireEvent(widget, "my-custom-signal");
 * ```
 *
 * @see {@link userEvent} for high-level user interactions
 */
export const fireEvent = async (element: Gtk.Widget, signalName: string, ...args: Arg[]): Promise<void> => {
    call(
        "libgobject-2.0.so.0",
        "g_signal_emit_by_name",
        [
            { type: { type: "gobject", ownership: "none" }, value: element.id },
            { type: { type: "string", ownership: "none" }, value: signalName },
            ...args,
        ],
        { type: "undefined" },
    );

    await tick();
};
