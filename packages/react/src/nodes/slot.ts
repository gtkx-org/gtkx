import type * as Gtk from "@gtkx/gi/gtk";
import { toCamelCase } from "@gtkx/utils";
import type { SlotProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { Props } from "../types.js";
import { SingleChildVirtualNode } from "./internal/single-child-virtual.js";
import { getFocusWidget, isDescendantOf } from "./internal/widget.js";
import { WidgetNode } from "./widget.js";

export class SlotNode<
    P extends Props = SlotProps,
    TChild extends WidgetNode = WidgetNode,
> extends SingleChildVirtualNode<P, WidgetNode, TChild> {
    private cachedSetter: ((child: Gtk.Widget | null) => void) | null = null;

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode | null): void {
        if (this.parent !== parent) {
            this.cachedSetter = null;
        }
        super.setParent(parent);
    }

    protected override onChildChange(oldChild: Gtk.Widget | null): void {
        const setter = this.ensureChildSetter();
        const childWidget = this.children[0]?.backingInstance ?? null;

        if (oldChild && !childWidget) {
            const parent = this.getParentWidget();
            const focus = getFocusWidget(oldChild);

            if (focus && isDescendantOf(focus, oldChild)) {
                parent.grabFocus();
            }
        }

        setter(childWidget);
    }

    protected override onDetach(oldChild: Gtk.Widget | null): void {
        if (!oldChild) return;

        const parentWidget = this.getParentWidget();
        if (parentWidget.getRoot() === null) return;

        this.cachedSetter = null;
        const setter = this.resolveChildSetter(parentWidget);
        const focus = getFocusWidget(oldChild);

        if (focus && isDescendantOf(focus, oldChild)) {
            parentWidget.grabFocus();
        }

        setter(null);
    }

    protected override detachesOnDelete(): boolean {
        return false;
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

        return this.parent.backingInstance;
    }

    private ensureChildSetter(): (child: Gtk.Widget | null) => void {
        if (this.cachedSetter) return this.cachedSetter;

        this.cachedSetter = this.resolveChildSetter(this.getParentWidget());
        return this.cachedSetter;
    }

    private resolveChildSetter(parent: Gtk.Widget): (child: Gtk.Widget | null) => void {
        const id = this.getId();
        return (child) => {
            Reflect.set(parent, id, child);
        };
    }
}
