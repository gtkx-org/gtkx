import type * as Gtk from "@gtkx/ffi/gtk";
import type { ContainerSlotProps } from "../jsx.js";
import type { Node } from "../node.js";
import { unparentWidget } from "./internal/widget.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class ContainerSlotNode extends VirtualNode<ContainerSlotProps, WidgetNode, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode | null): void {
        if (!parent && this.parent) {
            this.detachAllFromGtkParent();
        }

        super.setParent(parent);

        if (parent) {
            for (const child of this.children) {
                this.attachToParent(parent.container, child.container);
            }
        }
    }

    public override appendChild(child: WidgetNode): void {
        super.appendChild(child);

        if (this.parent) {
            unparentWidget(child.container);
            this.attachToParent(this.parent.container, child.container);
        }
    }

    public override insertBefore(child: WidgetNode, before: WidgetNode): void {
        super.insertBefore(child, before);

        if (this.parent) {
            this.reinsertAllChildren();
        }
    }

    public override removeChild(child: WidgetNode): void {
        unparentWidget(child.container);
        super.removeChild(child);
    }

    public override detachDeletedInstance(): void {
        if (this.parent) {
            this.detachAllFromGtkParent();
        }
        super.detachDeletedInstance();
    }

    private attachToParent(parent: Gtk.Widget, child: Gtk.Widget): void {
        const methodName = this.props.id;
        const method = parent[methodName as keyof Gtk.Widget];

        if (typeof method !== "function") {
            throw new Error(`Method '${methodName}' not found on '${parent.constructor.name}'`);
        }

        (method as (child: Gtk.Widget) => void).call(parent, child);
    }

    private reinsertAllChildren(): void {
        if (!this.parent) return;
        const parent = this.parent.container;

        for (const child of this.children) {
            unparentWidget(child.container);
        }

        for (const child of this.children) {
            this.attachToParent(parent, child.container);
        }
    }

    private detachAllFromGtkParent(): void {
        for (const child of this.children) {
            unparentWidget(child.container);
        }
    }
}
