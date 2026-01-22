import { isObjectEqual } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import { toCamelCase } from "@gtkx/gir";
import type { SlotProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import type { ContainerClass, Props } from "../types.js";
import { VirtualSingleChildNode } from "./abstract/virtual-single-child.js";
import { resolvePropMeta } from "./internal/utils.js";

type SlotNodeProps = Omit<SlotProps, "children">;

export class SlotNode<P extends Props = SlotNodeProps> extends VirtualSingleChildNode<P> {
    public static override priority = 2;

    public static override matches(type: string): boolean {
        return type === "Slot";
    }

    private cachedSetter: ((child: Gtk.Widget | null) => void) | null = null;

    public override setParent(parent: Gtk.Widget | null): void {
        if (this.parent !== parent) {
            this.cachedSetter = null;
        }
        super.setParent(parent);
    }

    public override unmount(): void {
        if (this.parent && this.child) {
            const parent = this.parent;
            const oldChild = this.child;
            this.child = null;

            queueMicrotask(() => {
                if (parent.getRoot() !== null) {
                    this.parent = parent;
                    this.onChildChange(oldChild);
                }
                this.parent = null;
            });
        } else {
            this.parent = null;
        }

        super.unmount();
    }

    public getChild(): Gtk.Widget {
        if (!this.child) {
            throw new Error(`Expected child widget to be set on '${this.getId()}' SlotNode`);
        }

        return this.child;
    }

    protected getId(): string {
        const id = (this.props as SlotProps).id;

        if (!id) {
            throw new Error("Expected 'id' prop to be present on Slot");
        }

        return toCamelCase(id);
    }

    protected override getParent(): Gtk.Widget {
        if (!this.parent) {
            throw new Error(`Expected parent widget to be set on '${this.getId()}' SlotNode`);
        }

        return this.parent;
    }

    protected ensureChildSetter(): (child: Gtk.Widget | null) => void {
        if (this.cachedSetter) return this.cachedSetter;

        const parent = this.getParent();
        const parentType = (parent.constructor as ContainerClass).glibTypeName;
        const setterName = resolvePropMeta(parent, this.getId());

        if (!setterName) {
            throw new Error(`Unable to find property for Slot '${this.getId()}' on type '${parentType}'`);
        }

        const setter = parent[setterName as keyof Gtk.Widget];

        if (typeof setter !== "function") {
            throw new Error(`Expected setter function for Slot '${this.getId()}' on type '${parentType}'`);
        }

        this.cachedSetter = setter.bind(parent) as (child: Gtk.Widget | null) => void;
        return this.cachedSetter;
    }

    protected onChildChange(oldChild: Gtk.Widget | null): void {
        const setter = this.ensureChildSetter();

        if (oldChild && !this.child) {
            const parent = this.getParent();
            const root = oldChild.getRoot();
            const focusWidget = root?.getFocus?.();

            if (focusWidget && this.isDescendantOf(focusWidget, oldChild)) {
                parent.grabFocus();
            }
        }

        setter(this.child);
    }

    private isDescendantOf(widget: Gtk.Widget, ancestor: Gtk.Widget): boolean {
        let current: Gtk.Widget | null = widget;

        while (current) {
            if (isObjectEqual(current, ancestor)) {
                return true;
            }

            current = current.getParent();
        }

        return false;
    }
}

registerNodeClass(SlotNode);
