import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import { appendChild, disconnectSignalHandlers, isConnectable, removeChild } from "../widget.js";

interface ActionBarWidget extends Gtk.Widget {
    packStart(child: unknown): void;
    remove(child: unknown): void;
    setRevealed(revealed: boolean): void;
}

const isActionBarWidget = (widget: Gtk.Widget): widget is ActionBarWidget =>
    "packStart" in widget &&
    typeof widget.packStart === "function" &&
    "remove" in widget &&
    typeof widget.remove === "function";

export class ActionBarNode implements Node<ActionBarWidget> {
    static needsWidget = true;

    static matches(type: string, widget: Gtk.Widget | null): widget is ActionBarWidget {
        if (type !== "ActionBar" && type !== "ActionBar.Root") return false;
        return widget !== null && isActionBarWidget(widget);
    }

    private widget: ActionBarWidget;
    private signalHandlers = new Map<string, number>();

    constructor(_type: string, widget: Gtk.Widget, _props: Props) {
        if (!isActionBarWidget(widget)) {
            throw new Error("ActionBarNode requires an ActionBar widget");
        }
        this.widget = widget;
    }

    getWidget(): ActionBarWidget {
        return this.widget;
    }

    appendChild(child: Node): void {
        child.attachToParent(this);
    }

    removeChild(child: Node): void {
        child.detachFromParent(this);
    }

    insertBefore(child: Node, _before: Node): void {
        this.appendChild(child);
    }

    attachToParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        if (parentWidget) {
            appendChild(parentWidget, this.widget);
        }
    }

    detachFromParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        if (parentWidget) {
            removeChild(parentWidget, this.widget);
        }
    }

    attachChild(childWidget: Gtk.Widget): void {
        this.widget.packStart(childWidget.ptr);
    }

    detachChild(childWidget: Gtk.Widget): void {
        this.widget.remove(childWidget.ptr);
    }

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
                if (oldHandlerId !== undefined && isConnectable(this.widget)) {
                    this.signalHandlers.delete(eventName);
                }

                if (typeof newValue === "function" && isConnectable(this.widget)) {
                    const handlerId = this.widget.connect(eventName, newValue as (...args: unknown[]) => void);
                    this.signalHandlers.set(eventName, handlerId);
                }
                continue;
            }

            const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            const setter = this.widget[setterName as keyof typeof this.widget];
            if (typeof setter === "function") {
                (setter as (value: unknown) => void).call(this.widget, newValue);
            }
        }
    }

    mount(): void {}

    dispose(): void {
        disconnectSignalHandlers(this.widget, this.signalHandlers);
    }
}
