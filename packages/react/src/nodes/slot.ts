import type * as Gtk from "@gtkx/ffi/gtk";
import { toCamelCase } from "@gtkx/gir";
import type { SlotProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { ContainerClass, Props } from "../types.js";
import { resolvePropMeta } from "./internal/utils.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

type SlotNodeProps = Omit<SlotProps, "children">;

export class SlotNode<P extends Props = SlotNodeProps> extends VirtualNode<P, WidgetNode, WidgetNode> {
    private cachedSetter: ((child: Gtk.Widget | null) => void) | null = null;
    private detachedParentWidget: Gtk.Widget | null = null;

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
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

    public override appendChild(child: Node): void {
        const oldChildWidget = this.children[0]?.container ?? null;

        super.appendChild(child);

        if (this.parent) {
            this.onChildChange(oldChildWidget);
        }
    }

    public override removeChild(child: Node): void {
        const oldChildWidget = (child as WidgetNode).container;

        super.removeChild(child);

        if (this.parent && oldChildWidget) {
            this.onChildChange(oldChildWidget);
        }
    }

    public override detachDeletedInstance(): void {
        const parentWidget = this.parent?.container ?? this.detachedParentWidget;

        if (parentWidget && this.children[0]) {
            const oldChild = this.children[0].container;

            queueMicrotask(() => {
                if (parentWidget.getRoot() !== null) {
                    this.cachedSetter = null;
                    const setter = this.resolveChildSetter(parentWidget);
                    if (setter) {
                        const focusWidget = this.getFocusWidget(oldChild);
                        if (focusWidget && this.isDescendantOf(focusWidget, oldChild)) {
                            parentWidget.grabFocus();
                        }
                        setter(null);
                    }
                }
                this.detachedParentWidget = null;
            });
        }

        super.detachDeletedInstance();
    }

    public getChildWidget(): Gtk.Widget {
        const child = this.children[0];
        if (!child) {
            throw new Error(`Expected child widget to be set on '${this.getId()}' SlotNode`);
        }

        return child.container;
    }

    public getId(): string {
        const id = (this.props as SlotProps).id;

        if (!id) {
            throw new Error("Expected 'id' prop to be present on Slot");
        }

        return toCamelCase(id);
    }

    public getParentWidget(): Gtk.Widget {
        if (!this.parent) {
            throw new Error(`Expected parent widget to be set on '${this.getId()}' SlotNode`);
        }

        return this.parent.container;
    }

    public ensureChildSetter(): (child: Gtk.Widget | null) => void {
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

    public onChildChange(oldChild: Gtk.Widget | null): void {
        const setter = this.ensureChildSetter();
        const childWidget = this.children[0]?.container ?? null;

        if (oldChild && !childWidget) {
            const parent = this.getParentWidget();
            const focusWidget = this.getFocusWidget(oldChild);

            if (focusWidget && this.isDescendantOf(focusWidget, oldChild)) {
                parent.grabFocus();
            }
        }

        setter(childWidget);
    }

    private resolveChildSetter(parent: Gtk.Widget): ((child: Gtk.Widget | null) => void) | null {
        const parentType = (parent.constructor as ContainerClass).glibTypeName;
        const propMeta = resolvePropMeta(parent, this.getId());

        if (!propMeta) {
            return null;
        }

        const [, setterName] = propMeta;
        const setter = parent[setterName as keyof Gtk.Widget];

        if (typeof setter !== "function") {
            throw new Error(`Expected setter function for Slot '${this.getId()}' on type '${parentType}'`);
        }

        return setter.bind(parent) as (child: Gtk.Widget | null) => void;
    }

    private getFocusWidget(widget: Gtk.Widget): Gtk.Widget | null {
        const root = widget.getRoot();
        return root?.getFocus?.() ?? null;
    }

    private isDescendantOf(widget: Gtk.Widget, ancestor: Gtk.Widget): boolean {
        let current: Gtk.Widget | null = widget;

        while (current) {
            if (current === ancestor) {
                return true;
            }

            current = current.getParent();
        }

        return false;
    }
}
