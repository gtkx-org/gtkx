import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { GridChildNode } from "./grid-child.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

export class GridNode extends WidgetNode<Gtk.Grid> {
    public override canAcceptChild(child: Node): boolean {
        return child instanceof GridChildNode || child instanceof SlotNode;
    }

    public override appendChild(child: Node): void {
        if (child instanceof GridChildNode || child instanceof SlotNode) {
            super.appendChild(child);
            return;
        }

        throw new Error(`Cannot append '${child.typeName}' to 'Grid': expected x.GridChild or Slot`);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof GridChildNode || child instanceof SlotNode) {
            super.insertBefore(child, before);
            return;
        }

        throw new Error(`Cannot insert '${child.typeName}' into 'Grid': expected x.GridChild or Slot`);
    }

    public override removeChild(child: Node): void {
        if (child instanceof GridChildNode || child instanceof SlotNode) {
            super.removeChild(child);
            return;
        }

        throw new Error(`Cannot remove '${child.typeName}' from 'Grid': expected x.GridChild or Slot`);
    }
}
