import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import { VirtualNode } from "../virtual.js";
import { WidgetNode } from "../widget.js";

type ChildParentWidget = Gtk.Widget & {
    remove(child: Gtk.Widget): void;
};

export abstract class VirtualContainerNode<P extends ChildParentWidget = ChildParentWidget> extends VirtualNode {
    protected parentWidget: P | null = null;

    public setParentWidget(newParent: P | null): void {
        this.parentWidget = newParent;
    }

    protected getParentWidget(): P {
        if (!this.parentWidget) {
            throw new Error(`Expected parent widget to be set on ${this.typeName}`);
        }
        return this.parentWidget;
    }

    protected abstract attachChild(parent: P, widget: Gtk.Widget): void;

    public override canAcceptChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append '${child.typeName}' to '${this.typeName}': expected Widget`);
        }

        super.appendChild(child);

        if (this.parentWidget) {
            this.attachChild(this.parentWidget, child.container);
        }
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot insert '${child.typeName}' into '${this.typeName}': expected Widget`);
        }

        super.insertBefore(child, before);

        if (this.parentWidget) {
            this.attachChild(this.parentWidget, child.container);
        }
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from '${this.typeName}': expected Widget`);
        }

        const widget = child.container;
        const parentWidget = this.parentWidget;

        if (parentWidget) {
            const currentParent = widget.getParent();
            if (currentParent && currentParent === parentWidget) {
                parentWidget.remove(widget);
            }
        }

        super.removeChild(child);
    }

    public override onAddedToParent(parent: Node): void {
        if (parent instanceof WidgetNode) {
            this.setParentWidget(parent.container as P);
            for (const child of this.children) {
                if (child instanceof WidgetNode && this.parentWidget) {
                    this.attachChild(this.parentWidget, child.container);
                }
            }
        }
    }

    public override onRemovedFromParent(parent: Node): void {
        if (parent instanceof WidgetNode) {
            this.detachAllChildren(parent.container as P);
        }
        this.setParentWidget(null);
    }

    public override detachDeletedInstance(): void {
        if (this.parentWidget) {
            this.detachAllChildren(this.parentWidget);
        }
        this.parentWidget = null;
        super.detachDeletedInstance();
    }

    private detachAllChildren(parent: P): void {
        for (const child of this.children) {
            if (child instanceof WidgetNode) {
                const currentParent = child.container.getParent();
                if (currentParent && currentParent === parent) {
                    parent.remove(child.container);
                }
            }
        }
    }
}
