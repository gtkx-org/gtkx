import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import type { Props } from "../types.js";
import { GridChildNode } from "./grid-child.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type GridChild = GridChildNode | SlotNode;

export class GridNode extends WidgetNode<Gtk.Grid, Props, GridChild> {
    public override isValidChild(child: Node): boolean {
        return child instanceof GridChildNode || child instanceof SlotNode;
    }

    public override appendChild(child: GridChild): void {
        super.appendChild(child);
    }

    public override insertBefore(child: GridChild, before: GridChild): void {
        super.insertBefore(child, before);
    }

    public override removeChild(child: GridChild): void {
        super.removeChild(child);
    }
}
