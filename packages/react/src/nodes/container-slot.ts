import type * as Gtk from "@gtkx/ffi/gtk";
import type { ContainerSlotProps } from "../jsx.js";
import type { Node } from "../node.js";
import { AttachOnParentVirtualNode } from "./internal/attach-on-parent-virtual.js";
import { WidgetNode } from "./widget.js";

export class ContainerSlotNode extends AttachOnParentVirtualNode<ContainerSlotProps, WidgetNode, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    protected override attachToParent(parent: Gtk.Widget, child: Gtk.Widget): void {
        const methodName = this.props.id;
        const method = parent[methodName as keyof Gtk.Widget];

        if (typeof method !== "function") {
            throw new Error(`Method '${methodName}' not found on '${parent.constructor.name}'`);
        }

        (method as (child: Gtk.Widget) => void).call(parent, child);
    }
}
