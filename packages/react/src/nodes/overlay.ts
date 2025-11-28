import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import { appendChild, disconnectSignalHandlers, isConnectable, removeChild } from "../widget-capabilities.js";

interface OverlayWidget extends Gtk.Widget {
    setChild(child: unknown): void;
    addOverlay(widget: unknown): void;
    removeOverlay(widget: unknown): void;
}

const isOverlayWidget = (widget: Gtk.Widget): widget is OverlayWidget =>
    "setChild" in widget &&
    typeof widget.setChild === "function" &&
    "addOverlay" in widget &&
    typeof widget.addOverlay === "function" &&
    "removeOverlay" in widget &&
    typeof widget.removeOverlay === "function";

export class OverlayNode implements Node<OverlayWidget> {
    static needsWidget = true;

    static matches(type: string, widget: Gtk.Widget | null): widget is OverlayWidget {
        if (type !== "Overlay" && type !== "Overlay.Root") return false;
        return widget !== null && isOverlayWidget(widget);
    }

    private widget: OverlayWidget;
    private mainChild: Gtk.Widget | null = null;
    private overlayChildren: Gtk.Widget[] = [];
    private signalHandlers = new Map<string, number>();

    constructor(_type: string, widget: Gtk.Widget, _props: Props) {
        if (!isOverlayWidget(widget)) {
            throw new Error("OverlayNode requires an Overlay widget");
        }
        this.widget = widget;
    }

    getWidget(): OverlayWidget {
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
        if (this.mainChild === null) {
            this.mainChild = childWidget;
            this.widget.setChild(childWidget.ptr);
        } else {
            this.overlayChildren.push(childWidget);
            this.widget.addOverlay(childWidget.ptr);
        }
    }

    detachChild(childWidget: Gtk.Widget): void {
        if (this.mainChild === childWidget) {
            this.widget.setChild(null);
            this.mainChild = null;
        } else {
            const index = this.overlayChildren.indexOf(childWidget);
            if (index !== -1) {
                this.overlayChildren.splice(index, 1);
                this.widget.removeOverlay(childWidget.ptr);
            }
        }
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
