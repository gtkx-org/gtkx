import type * as Gtk from "@gtkx/ffi/gtk";
import { toCamelCase } from "@gtkx/gir";
import type { SlotProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { ContainerClass, Props } from "../types.js";
import { getFocusWidget, isDescendantOf, resolvePropertySetter } from "./internal/widget.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class SlotNode<P extends Props = SlotProps, TChild extends Node = WidgetNode> extends VirtualNode<
    P,
    WidgetNode,
    TChild
> {
    private cachedSetter: ((child: Gtk.Widget | null) => void) | null = null;
    private detachedParentWidget: Gtk.Widget | null = null;

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode | null): void {
        const previousParent = this.parent;
        if (previousParent !== parent) {
            this.cachedSetter = null;
        }

        if (!parent && previousParent) {
            this.detachedParentWidget = previousParent.container;
        }

        super.setParent(parent);

        if (parent && this.children[0]) {
            this.onChildChange(null);
        }
    }

    public override appendChild(child: TChild): void {
        const firstChild = this.children[0];
        const oldChildWidget = firstChild instanceof WidgetNode ? firstChild.container : null;

        super.appendChild(child);

        if (this.parent) {
            this.onChildChange(oldChildWidget);
        }
    }

    public override removeChild(child: TChild): void {
        const oldChildWidget = child instanceof WidgetNode ? child.container : null;

        super.removeChild(child);

        if (this.parent && oldChildWidget) {
            this.onChildChange(oldChildWidget);
        }
    }

    public override detachDeletedInstance(): void {
        const parentWidget = this.parent?.container ?? this.detachedParentWidget;

        if (parentWidget && this.children[0]) {
            if (parentWidget.getRoot() !== null) {
                this.cachedSetter = null;
                const setter = this.resolveChildSetter(parentWidget);
                if (setter) {
                    const oldChild = this.children[0].container;
                    const focus = getFocusWidget(oldChild);
                    if (focus && isDescendantOf(focus, oldChild)) {
                        parentWidget.grabFocus();
                    }
                    setter(null);
                }
            }
            this.detachedParentWidget = null;
        }

        super.detachDeletedInstance();
    }

    private getId(): string {
        const id = (this.props as SlotProps).id;

        if (!id) {
            throw new Error("Expected 'id' prop to be present on Slot");
        }

        return toCamelCase(id);
    }

    private getParentWidget(): Gtk.Widget {
        if (!this.parent) {
            throw new Error(`Expected parent widget to be set on '${this.getId()}' SlotNode`);
        }

        return this.parent.container;
    }

    private ensureChildSetter(): (child: Gtk.Widget | null) => void {
        if (this.cachedSetter) return this.cachedSetter;

        const parent = this.getParentWidget();
        const setter = this.resolveChildSetter(parent);

        if (!setter) {
            const parentType = (parent.constructor as ContainerClass).glibTypeName;
            throw new Error(`Unable to find property for Slot '${this.getId()}' on type '${parentType}'`);
        }

        this.cachedSetter = setter;
        return this.cachedSetter;
    }

    private onChildChange(oldChild: Gtk.Widget | null): void {
        const setter = this.ensureChildSetter();
        const childWidget = this.children[0]?.container ?? null;

        if (oldChild && !childWidget) {
            const parent = this.getParentWidget();
            const focus = getFocusWidget(oldChild);

            if (focus && isDescendantOf(focus, oldChild)) {
                parent.grabFocus();
            }
        }

        setter(childWidget);
    }

    private resolveChildSetter(parent: Gtk.Widget): ((child: Gtk.Widget | null) => void) | null {
        return resolvePropertySetter(parent, this.getId());
    }
}
