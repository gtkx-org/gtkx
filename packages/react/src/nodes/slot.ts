import type * as Gtk from "@gtkx/ffi/gtk";
import { toCamelCase } from "@gtkx/gir";
import { PROPS } from "../generated/internal.js";
import type { SlotProps } from "../jsx.js";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { ContainerClass } from "../types.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

type SlotNodeProps = Omit<SlotProps, "children">;

export class SlotNode<P extends SlotNodeProps = SlotNodeProps> extends VirtualNode<P> {
    public static override priority = 2;

    public static override matches(type: string): boolean {
        return type === "Slot";
    }

    parent?: Gtk.Widget;
    child?: Gtk.Widget;

    public setParent(parent?: Gtk.Widget): void {
        this.parent = parent;
        if (parent && this.child) {
            this.onChildChange(undefined);
        }
    }

    protected getId(): string {
        const id = (this.props as SlotProps).id;
        if (!id) {
            throw new Error(`Slot id is not set on SlotNode`);
        }

        return toCamelCase(id);
    }

    private getParent(): Gtk.Widget {
        if (!this.parent) {
            throw new Error(`Parent is not set on ${this.getId()} SlotNode`);
        }

        return this.parent;
    }

    public getChild(): Gtk.Widget {
        if (!this.child) {
            throw new Error(`Child is not set on ${this.getId()} SlotNode`);
        }

        return this.child;
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append child of type ${child.typeName} to Slot`);
        }

        const oldChild = this.child;
        this.child = child.container;
        if (this.parent) {
            this.onChildChange(oldChild);
        }
    }

    public override removeChild(): void {
        const oldChild = this.child;
        this.child = undefined;
        this.onChildChange(oldChild);
    }

    protected onChildChange(_oldChild: Gtk.Widget | undefined): void {
        const parent = this.getParent();
        const parentType = (parent.constructor as ContainerClass).glibTypeName;
        const [_, setterName] = PROPS[parentType]?.[this.getId()] ?? [];

        if (!setterName) {
            throw new Error(`No property found for Slot ${this.getId()} on parent type ${parentType}`);
        }

        const setter = parent[setterName as keyof Gtk.Widget];

        if (typeof setter !== "function") {
            throw new Error(`Setter is not a function for Slot ${this.getId()} on parent type ${parentType}`);
        }

        setter.call(parent, this.child);
    }
}

registerNodeClass(SlotNode);
