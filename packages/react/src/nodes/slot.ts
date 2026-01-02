import type * as Gtk from "@gtkx/ffi/gtk";
import { toCamelCase } from "@gtkx/gir";
import type { SlotProps } from "../jsx.js";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import { scheduleAfterCommit } from "../scheduler.js";
import type { ContainerClass } from "../types.js";
import { resolvePropMeta } from "./internal/utils.js";
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
    }

    public override unmount(): void {
        if (this.parent && this.child) {
            const oldChild = this.child;
            this.child = undefined;
            this.onChildChange(oldChild ?? null);
        }

        this.parent = undefined;
        super.unmount();
    }

    protected getId(): string {
        const id = (this.props as SlotProps).id;

        if (!id) {
            throw new Error("Expected 'id' prop to be present on Slot");
        }

        return toCamelCase(id);
    }

    protected getParent(): Gtk.Widget {
        if (!this.parent) {
            throw new Error(`Expected parent widget to be set on '${this.getId()}' SlotNode`);
        }

        return this.parent;
    }

    public getChild(): Gtk.Widget {
        if (!this.child) {
            throw new Error(`Expected child widget to be set on '${this.getId()}' SlotNode`);
        }

        return this.child;
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'Slot': expected Widget`);
        }

        const oldChild = this.child;
        this.child = child.container;

        scheduleAfterCommit(() => {
            if (this.parent) {
                this.onChildChange(oldChild ?? null);
            }
        });
    }

    public override removeChild(): void {
        const oldChild = this.child;

        scheduleAfterCommit(() => {
            if (oldChild === this.child) {
                this.child = undefined;
            }

            if (this.parent) {
                this.onChildChange(oldChild ?? null);
            }
        });
    }

    protected onChildChange(oldChild: Gtk.Widget | null): void {
        const parent = this.getParent();
        const parentType = (parent.constructor as ContainerClass).glibTypeName;
        const propMeta = resolvePropMeta(parent, this.getId());

        if (!propMeta) {
            throw new Error(`Unable to find property for Slot '${this.getId()}' on type '${parentType}'`);
        }

        const [_, setterName] = propMeta;

        const setter = parent[setterName as keyof Gtk.Widget];

        if (typeof setter !== "function") {
            throw new Error(`Expected setter function for Slot '${this.getId()}' on type '${parentType}'`);
        }

        if (oldChild && !this.child) {
            const root = oldChild.getRoot();
            const focusWidget = root?.getFocus?.();

            if (focusWidget && this.isDescendantOf(focusWidget, oldChild)) {
                parent.grabFocus();
            }
        }

        setter.call(parent, this.child);
    }

    private isDescendantOf(widget: Gtk.Widget, ancestor: Gtk.Widget): boolean {
        let current: Gtk.Widget | null = widget;

        while (current) {
            if (current.equals(ancestor)) {
                return true;
            }

            current = current.getParent();
        }

        return false;
    }
}

registerNodeClass(SlotNode);
