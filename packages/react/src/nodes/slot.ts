import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";

/**
 * Node implementation for named child slots.
 * Handles widget properties that accept a single child widget,
 * like HeaderBar's start/end slots.
 */
export class SlotNode implements Node {
    static needsWidget = false;

    static matches(type: string, _widget: Gtk.Widget | null): _widget is Gtk.Widget {
        if (!type.includes(".")) return false;
        const parts = type.split(".");
        if (parts.length !== 2) return false;
        const suffix = parts[1];
        return suffix !== "Item" && suffix !== "Root";
    }

    private child: Node | null = null;
    private slotName: string;

    constructor(type: string, _widget: Gtk.Widget, _props: Props) {
        const dotIndex = type.indexOf(".");
        if (dotIndex === -1) {
            throw new Error(`Invalid slot type: ${type}`);
        }
        this.slotName = type.substring(dotIndex + 1);
    }

    appendChild(child: Node): void {
        if (child.getWidget) {
            this.child = child;
        }
    }

    removeChild(_child: Node): void {
        this.child = null;
    }

    insertBefore(child: Node, _before: Node): void {
        this.appendChild(child);
    }

    updateProps(_oldProps: Props, _newProps: Props): void {}

    mount(): void {}

    attachToParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        const childWidget = this.child?.getWidget?.();
        if (!parentWidget || !childWidget) return;

        const setterName = `set${this.slotName}`;
        const setter = parentWidget[setterName as keyof Gtk.Widget];
        if (typeof setter === "function") {
            (setter as (ptr: unknown) => void).call(parentWidget, childWidget.ptr);
        }
    }

    detachFromParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        if (!parentWidget) return;

        const setterName = `set${this.slotName}`;
        const setter = parentWidget[setterName as keyof Gtk.Widget];
        if (typeof setter === "function") {
            (setter as (ptr: null) => void).call(parentWidget, null);
        }
    }
}
