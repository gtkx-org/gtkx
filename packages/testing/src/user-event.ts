import type * as Gtk from "@gtkx/ffi/gtk";
import { call } from "@gtkx/native";
import { getWidgetPtr, hasGetText, hasSetText } from "./widget.js";

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

/**
 * Options for configuring user event behavior.
 */
export interface UserEventOptions {
    /** Delay between events in milliseconds */
    delay?: number;
}

/**
 * Instance returned by userEvent.setup() with bound options.
 */
export interface UserEventInstance {
    /** Simulates a click on the element */
    click: (element: Gtk.Widget) => Promise<void>;
    /** Simulates a double-click on the element */
    dblClick: (element: Gtk.Widget) => Promise<void>;
    /** Types text into an input element */
    type: (element: Gtk.Widget, text: string) => Promise<void>;
    /** Clears the text content of an input element */
    clear: (element: Gtk.Widget) => Promise<void>;
}

const createUserEventInstance = (_options?: UserEventOptions): UserEventInstance => {
    return {
        click: async (element: Gtk.Widget): Promise<void> => {
            emitSignal(element, "clicked");
        },

        dblClick: async (element: Gtk.Widget): Promise<void> => {
            emitSignal(element, "clicked");
            emitSignal(element, "clicked");
        },

        type: async (element: Gtk.Widget, text: string): Promise<void> => {
            if (!hasSetText(element)) {
                throw new Error("Cannot type into element: no setText method available");
            }

            const currentText = hasGetText(element) ? element.getText() : "";
            element.setText(currentText + text);
        },

        clear: async (element: Gtk.Widget): Promise<void> => {
            if (!hasSetText(element)) {
                throw new Error("Cannot clear element: no setText method available");
            }

            element.setText("");
        },
    };
};

/**
 * Simulates user interactions with GTK widgets. Provides methods that mimic
 * real user behavior like clicking, typing, and clearing input fields.
 * Use userEvent.setup() to create an instance with custom options.
 */
export const userEvent = {
    setup: (options?: UserEventOptions): UserEventInstance => createUserEventInstance(options),

    click: async (element: Gtk.Widget): Promise<void> => {
        emitSignal(element, "clicked");
    },

    dblClick: async (element: Gtk.Widget): Promise<void> => {
        emitSignal(element, "clicked");
        emitSignal(element, "clicked");
    },

    type: async (element: Gtk.Widget, text: string): Promise<void> => {
        if (!hasSetText(element)) {
            throw new Error("Cannot type into element: no setText method available");
        }

        const currentText = hasGetText(element) ? element.getText() : "";
        element.setText(currentText + text);
    },

    clear: async (element: Gtk.Widget): Promise<void> => {
        if (!hasSetText(element)) {
            throw new Error("Cannot clear element: no setText method available");
        }

        element.setText("");
    },
};
