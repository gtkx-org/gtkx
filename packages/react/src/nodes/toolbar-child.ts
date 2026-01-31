import type * as Adw from "@gtkx/ffi/adw";
import type { Node } from "../node.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class ToolbarTopNode extends VirtualNode<unknown, WidgetNode<Adw.ToolbarView>, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode<Adw.ToolbarView> | null): void {
        const previousParent = this.parent;
        super.setParent(parent);

        if (parent) {
            for (const child of this.children) {
                parent.container.addTopBar(child.container);
            }
        } else if (previousParent) {
            this.detachAllChildren(previousParent.container);
        }
    }

    public override appendChild(child: Node): void {
        super.appendChild(child);

        if (this.parent) {
            this.parent.container.addTopBar((child as WidgetNode).container);
        }
    }

    public override insertBefore(child: Node, before: Node): void {
        super.insertBefore(child, before);

        if (this.parent) {
            this.parent.container.addTopBar((child as WidgetNode).container);
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

    private detachAllChildren(parent: Adw.ToolbarView): void {
        for (const child of this.children) {
            const currentParent = child.container.getParent();
            if (currentParent && currentParent === parent) {
                parent.remove(child.container);
            }
        }
    }
}

export class ToolbarBottomNode extends VirtualNode<unknown, WidgetNode<Adw.ToolbarView>, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode<Adw.ToolbarView> | null): void {
        const previousParent = this.parent;
        super.setParent(parent);

        if (parent) {
            for (const child of this.children) {
                parent.container.addBottomBar(child.container);
            }
        } else if (previousParent) {
            this.detachAllChildren(previousParent.container);
        }
    }

    public override appendChild(child: Node): void {
        super.appendChild(child);

        if (this.parent) {
            this.parent.container.addBottomBar((child as WidgetNode).container);
        }
    }

    public override insertBefore(child: Node, before: Node): void {
        super.insertBefore(child, before);

        if (this.parent) {
            this.parent.container.addBottomBar((child as WidgetNode).container);
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

    private detachAllChildren(parent: Adw.ToolbarView): void {
        for (const child of this.children) {
            const currentParent = child.container.getParent();
            if (currentParent && currentParent === parent) {
                parent.remove(child.container);
            }
        }
    }
}
