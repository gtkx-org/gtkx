import type * as Gtk from "@gtkx/ffi/gtk";
import type { Arg } from "@gtkx/native";
import { call } from "@gtkx/native";
import { tick } from "./timing.js";

export const fireEvent = async (element: Gtk.Widget, signalName: string, ...args: Arg[]): Promise<void> => {
    call(
        "libgobject-2.0.so.0",
        "g_signal_emit_by_name",
        [{ type: { type: "gobject" }, value: element.id }, { type: { type: "string" }, value: signalName }, ...args],
        { type: "undefined" },
    );

    await tick();
};
