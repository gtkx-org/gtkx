import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import { Node } from "../node.js";

export class SlotNode extends Node<never> {
    static matches(type: string): boolean {
        if (!type.includes(".")) return false;
        const parts = type.split(".");
        if (parts.length !== 2) return false;
        const suffix = parts[1];
        return suffix !== "Root";
    }

    protected override isVirtual(): boolean {
        return true;
    }

    private child: Node | null = null;
    private slotName: string;
    private parentNode: Node | null = null;

    constructor(type: string, props: Props) {
        super(type, props);

        const dotIndex = type.indexOf(".");

        if (dotIndex === -1) {
            throw new Error(`Invalid slot type: ${type}`);
        }

        this.slotName = type.substring(dotIndex + 1);
    }

    private updateParentSlot(): void {
        if (!this.parentNode) return;

        const parentWidget = this.parentNode.getWidget();
        const childWidget = this.child?.getWidget();

        if (!parentWidget) return;

        const setterName = `set${this.slotName}`;
        const setter = parentWidget[setterName as keyof Gtk.Widget];

        if (typeof setter === "function") {
            (setter as (ptr: unknown) => void).call(parentWidget, childWidget?.ptr ?? null);
        }
    }

    override appendChild(child: Node): void {
        if (child.getWidget()) {
            this.child = child;
            this.updateParentSlot();
        }
    }

    override removeChild(_child: Node): void {
        this.child = null;
        this.updateParentSlot();
    }

    override attachToParent(parent: Node): void {
        this.parentNode = parent;
        this.updateParentSlot();
    }

    override detachFromParent(_parent: Node): void {
        if (this.parentNode) {
            const parentWidget = this.parentNode.getWidget();

            if (parentWidget) {
                const setterName = `set${this.slotName}`;
                const setter = parentWidget[setterName as keyof Gtk.Widget];

                if (typeof setter === "function") {
                    (setter as (ptr: null) => void).call(parentWidget, null);
                }
            }
        }

        this.parentNode = null;
    }
}
