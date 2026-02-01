import type * as Gtk from "@gtkx/ffi/gtk";
import type { ContainerSlotProps } from "../jsx.js";
import type { Node } from "../node.js";
import { isRemovable } from "./internal/predicates.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class ContainerSlotNode extends VirtualNode<ContainerSlotProps, WidgetNode, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode | null): void {
        const previousParent = this.parent;
        super.setParent(parent);

        if (parent) {
            for (const child of this.children) {
                this.attach(parent.container, child.container);
            }
        } else if (previousParent) {
            this.detachAllChildren(previousParent.container);
        }
    }

    public override appendChild(child: WidgetNode): void {
        super.appendChild(child);

        if (this.parent) {
            this.attach(this.parent.container, child.container);
        }
    }

    public override insertBefore(child: WidgetNode, before: WidgetNode): void {
        super.insertBefore(child, before);

        if (this.parent) {
            this.attach(this.parent.container, child.container);
        }
    }

    public override removeChild(child: WidgetNode): void {
        if (this.parent && isRemovable(this.parent.container)) {
            const widget = child.container;
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

    private attach(parent: Gtk.Widget, child: Gtk.Widget): void {
        const methodName = this.props.id;
        const method = parent[methodName as keyof Gtk.Widget];

        if (typeof method !== "function") {
            throw new Error(`Method '${methodName}' not found on '${parent.constructor.name}'`);
        }

        (method as (child: Gtk.Widget) => void).call(parent, child);
    }

    private detachAllChildren(parent: Gtk.Widget): void {
        if (!isRemovable(parent)) return;

        for (const child of this.children) {
            const currentParent = child.container.getParent();
            if (currentParent && currentParent === parent) {
                parent.remove(child.container);
            }
        }
    }
}
