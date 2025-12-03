import type * as Gtk from "@gtkx/ffi/gtk";
import { call } from "@gtkx/native";
import { getWidgetPtr } from "./widget.js";

const emitSignal = (widget: Gtk.Widget, signalName: string): void => {
    call(
        "libgobject-2.0.so.0",
        "g_signal_emit_by_name",
        [
            { type: { type: "gobject" }, value: getWidgetPtr(widget) },
            { type: { type: "string" }, value: signalName },
        ],
        { type: "undefined" },
    );
};

type FireEventFunction = {
    (element: Gtk.Widget, signalName: string): void;
    click: (element: Gtk.Widget) => void;
    activate: (element: Gtk.Widget) => void;
    toggled: (element: Gtk.Widget) => void;
    changed: (element: Gtk.Widget) => void;
};

/**
 * Fires GTK signals on widgets for testing. Can be called directly with a signal
 * name or using convenience methods like fireEvent.click().
 * @example
 * fireEvent(button, "clicked")
 * fireEvent.click(button)
 */
export const fireEvent: FireEventFunction = Object.assign(
    (element: Gtk.Widget, signalName: string): void => {
        emitSignal(element, signalName);
    },
    {
        click: (element: Gtk.Widget): void => {
            emitSignal(element, "clicked");
        },
        activate: (element: Gtk.Widget): void => {
            emitSignal(element, "activate");
        },
        toggled: (element: Gtk.Widget): void => {
            emitSignal(element, "toggled");
        },
        changed: (element: Gtk.Widget): void => {
            emitSignal(element, "changed");
        },
    },
);
