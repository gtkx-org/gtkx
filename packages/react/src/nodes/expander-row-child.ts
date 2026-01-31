import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

type ExpanderRowWidget = Gtk.Widget & {
    addRow(child: Gtk.Widget): void;
    addAction(child: Gtk.Widget): void;
    remove(child: Gtk.Widget): void;
};

export class ExpanderRowRowNode extends VirtualNode<unknown, WidgetNode<ExpanderRowWidget>, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode<ExpanderRowWidget> | null): void {
        const previousParent = this.parent;
        super.setParent(parent);

        if (parent) {
            for (const child of this.children) {
                parent.container.addRow(child.container);
            }
        } else if (previousParent) {
            this.detachAllChildren(previousParent.container);
        }
    }

    public override appendChild(child: Node): void {
        super.appendChild(child);

        if (this.parent) {
            this.parent.container.addRow((child as WidgetNode).container);
        }
    }

    public override insertBefore(child: Node, before: Node): void {
        super.insertBefore(child, before);

        if (this.parent) {
            this.parent.container.addRow((child as WidgetNode).container);
        }
    }

    public override removeChild(child: Node): void {
        if (this.parent) {
            const widget = (child as WidgetNode).container;
            const currentParent = widget.getParent();
            if (currentParent && currentParent === this.parent.container) {
                this.parent.container.remove(widget);
            }
        }

        super.removeChild(child);
    }

    public override detachDeletedInstance(): void {
        if (this.parent) {
            this.detachAllChildren(this.parent.container);
        }
        super.detachDeletedInstance();
    }

    private detachAllChildren(parent: ExpanderRowWidget): void {
        for (const child of this.children) {
            const currentParent = child.container.getParent();
            if (currentParent && currentParent === parent) {
                parent.remove(child.container);
            }
        }
    }
}

export class ExpanderRowActionNode extends VirtualNode<unknown, WidgetNode<ExpanderRowWidget>, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode<ExpanderRowWidget> | null): void {
        const previousParent = this.parent;
        super.setParent(parent);

        if (parent) {
            for (const child of this.children) {
                parent.container.addAction(child.container);
            }
        } else if (previousParent) {
            this.detachAllChildren(previousParent.container);
        }
    }

    public override appendChild(child: Node): void {
        super.appendChild(child);

        if (this.parent) {
            this.parent.container.addAction((child as WidgetNode).container);
        }
    }

    public override insertBefore(child: Node, before: Node): void {
        super.insertBefore(child, before);

        if (this.parent) {
            this.parent.container.addAction((child as WidgetNode).container);
        }
    }

    public override removeChild(child: Node): void {
        if (this.parent) {
            const widget = (child as WidgetNode).container;
            const currentParent = widget.getParent();
            if (currentParent && currentParent === this.parent.container) {
                this.parent.container.remove(widget);
            }
        }

        super.removeChild(child);
    }

    public override detachDeletedInstance(): void {
        if (this.parent) {
            this.detachAllChildren(this.parent.container);
        }
        super.detachDeletedInstance();
    }

    private detachAllChildren(parent: ExpanderRowWidget): void {
        for (const child of this.children) {
            const currentParent = child.container.getParent();
            if (currentParent && currentParent === parent) {
                parent.remove(child.container);
            }
        }
    }
}
