import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import type { Props } from "../../types.js";
import { VirtualNode } from "../virtual.js";
import { WidgetNode } from "../widget.js";

export abstract class VirtualSingleChildNode<P extends Props = Props> extends VirtualNode<P> {
    protected parentWidget: Gtk.Widget | null = null;
    childWidget: Gtk.Widget | null = null;

    public setParentWidget(parent: Gtk.Widget | null): void {
        this.parentWidget = parent;
    }

    protected getParentWidget(): Gtk.Widget {
        if (!this.parentWidget) {
            throw new Error(`Expected parent widget to be set on ${this.typeName}`);
        }
        return this.parentWidget;
    }

    protected getTypedParentWidget<T extends Gtk.Widget>(): T {
        return this.getParentWidget() as T;
    }

    protected abstract onChildChange(oldChild: Gtk.Widget | null): void;

    public override canAcceptChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append '${child.typeName}' to '${this.typeName}': expected Widget`);
        }

        const oldChild = this.childWidget;
        this.childWidget = child.container;

        super.appendChild(child);

        if (this.parentWidget) {
            this.onChildChange(oldChild);
        }
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from '${this.typeName}': expected Widget`);
        }

        const oldChild = this.childWidget;
        this.childWidget = null;

        super.removeChild(child);

        if (this.parentWidget && oldChild) {
            this.onChildChange(oldChild);
        }
    }

    public override onAddedToParent(parent: Node): void {
        if (parent instanceof WidgetNode) {
            this.setParentWidget(parent.container);
            if (this.childWidget) {
                this.onChildChange(null);
            }
        }
    }

    public override onRemovedFromParent(_parent: Node): void {}

    public override detachDeletedInstance(): void {
        this.parentWidget = null;
        super.detachDeletedInstance();
    }
}
