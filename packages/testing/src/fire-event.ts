import type * as Gtk from "@gtkx/ffi/gtk";
import type { Arg } from "@gtkx/native";
import { call } from "@gtkx/native";
import { tick } from "./timing.js";

/**
 * Low-level utility to emit GTK signals on widgets. For common interactions
 * like clicking or typing, use `userEvent` instead.
 *
 * @param element - The GTK widget to emit the signal on
 * @param signalName - The name of the signal to emit
 * @param args - Additional arguments to pass to the signal handlers
 *
 * @example
 * await fireEvent(button, "clicked")
 *
 * @example
 * await fireEvent(widget, "custom-signal", { type: { type: "int", size: 32 }, value: 42 })
 */
export const fireEvent = async (element: Gtk.Widget, signalName: string, ...args: Arg[]): Promise<void> => {
    call(
        "libgobject-2.0.so.0",
        "g_signal_emit_by_name",
        [{ type: { type: "gobject" }, value: element.id }, { type: { type: "string" }, value: signalName }, ...args],
        { type: "undefined" },
    );

    await tick();
};
