import * as GObject from "@gtkx/ffi/gobject";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import { getActiveWindow } from "../reconciler.js";
import { disconnectSignalHandlers, isConnectable } from "../widget-capabilities.js";

const DIALOG_TYPES = new Set([
    "AboutDialog",
    "Dialog",
    "AppChooserDialog",
    "ColorChooserDialog",
    "FontChooserDialog",
    "FileChooserDialog",
    "MessageDialog",
    "PageSetupUnixDialog",
    "PrintUnixDialog",
    "Assistant",
    "ShortcutsWindow",
]);

const isDialog = (widget: Gtk.Widget): widget is Gtk.Window => {
    return "setTransientFor" in widget && "present" in widget;
};

export class DialogNode implements Node {
    static needsWidget = true;

    static matches(type: string, widget: Gtk.Widget | null): widget is Gtk.Widget {
        const normalizedType = type.endsWith(".Root") ? type.slice(0, -5) : type;
        return widget !== null && DIALOG_TYPES.has(normalizedType);
    }

    private widget: Gtk.Widget;
    private signalHandlers = new Map<string, number>();

    constructor(_type: string, widget: Gtk.Widget, _props: Props) {
        this.widget = widget;
    }

    getWidget(): Gtk.Widget {
        return this.widget;
    }

    appendChild(_child: Node): void {}

    removeChild(_child: Node): void {}

    insertBefore(_child: Node, _before: Node): void {}

    attachToParent(_parent: Node): void {}

    detachFromParent(_parent: Node): void {}

    updateProps(oldProps: Props, newProps: Props): void {
        const consumedProps = new Set(["children"]);
        const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

        for (const key of allKeys) {
            if (consumedProps.has(key)) continue;

            const oldValue = oldProps[key];
            const newValue = newProps[key];

            if (oldValue === newValue) continue;

            if (key.startsWith("on")) {
                const eventName = key
                    .slice(2)
                    .replace(/([A-Z])/g, "-$1")
                    .toLowerCase()
                    .replace(/^-/, "");

                const oldHandlerId = this.signalHandlers.get(eventName);
                if (oldHandlerId !== undefined) {
                    GObject.signalHandlerDisconnect(this.widget as unknown as GObject.GObject, oldHandlerId);
                    this.signalHandlers.delete(eventName);
                }

                if (typeof newValue === "function" && isConnectable(this.widget)) {
                    const handlerId = this.widget.connect(eventName, newValue as (...args: unknown[]) => void);
                    this.signalHandlers.set(eventName, handlerId);
                }
                continue;
            }

            if (newValue === undefined) continue;

            const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            const setter = this.widget[setterName as keyof typeof this.widget];
            if (typeof setter === "function") {
                (setter as (value: unknown) => void).call(this.widget, newValue);
            }
        }
    }

    mount(): void {
        if (isDialog(this.widget)) {
            const activeWindow = getActiveWindow();
            if (activeWindow) {
                this.widget.setTransientFor(activeWindow);
            }
            this.widget.present();
        }
    }

    dispose(): void {
        disconnectSignalHandlers(this.widget, this.signalHandlers);
    }
}
