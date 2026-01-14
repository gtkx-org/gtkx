import * as Adw from "@gtkx/ffi/adw";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { ActionRowChild } from "./action-row-child.js";
import { ExpanderRowChild } from "./expander-row-child.js";
import { isContainerType } from "./internal/utils.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

class ExpanderRowNode extends WidgetNode<Adw.ExpanderRow> {
    public static override priority = -1;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return isContainerType(Adw.ExpanderRow, containerOrClass);
    }

    public override appendChild(child: Node): void {
        if (child instanceof ExpanderRowChild) {
            child.setParent(this.container);
            return;
        }

        if (child instanceof ActionRowChild) {
            child.setParent(this.container);
            return;
        }

        if (child instanceof SlotNode || child instanceof WidgetNode) {
            super.appendChild(child);
            return;
        }

        throw new Error(
            `Cannot append '${child.typeName}' to 'ExpanderRow': expected x.ExpanderRowRow, x.ExpanderRowAction, x.ActionRowPrefix, x.ActionRowSuffix, or Widget`,
        );
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof ExpanderRowChild) {
            child.setParent(this.container);
            return;
        }

        if (child instanceof ActionRowChild) {
            child.setParent(this.container);
            return;
        }

        if (child instanceof SlotNode || child instanceof WidgetNode) {
            super.insertBefore(child, before);
            return;
        }

        throw new Error(
            `Cannot insert '${child.typeName}' into 'ExpanderRow': expected x.ExpanderRowRow, x.ExpanderRowAction, x.ActionRowPrefix, x.ActionRowSuffix, or Widget`,
        );
    }

    public override removeChild(child: Node): void {
        if (child instanceof ExpanderRowChild || child instanceof ActionRowChild) {
            child.unmount();
            return;
        }

        if (child instanceof SlotNode || child instanceof WidgetNode) {
            super.removeChild(child);
            return;
        }

        throw new Error(
            `Cannot remove '${child.typeName}' from 'ExpanderRow': expected x.ExpanderRowRow, x.ExpanderRowAction, x.ActionRowPrefix, x.ActionRowSuffix, or Widget`,
        );
    }
}

registerNodeClass(ExpanderRowNode);
