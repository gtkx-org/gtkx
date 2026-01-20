import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { isAttachable } from "./internal/predicates.js";
import { matchesAnyClass } from "./internal/utils.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

class GridNode extends WidgetNode<Gtk.Grid> {
    public static override priority = 0;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return matchesAnyClass([Gtk.Grid], containerOrClass);
    }

    private isGridChild(child: Node): boolean {
        return child.typeName === "GridChild";
    }

    public override appendChild(child: Node): void {
        if (child instanceof SlotNode) {
            super.appendChild(child);
            return;
        }

        if (isAttachable(child) && this.isGridChild(child)) {
            child.attachTo(this);
            return;
        }

        throw new Error(`Cannot append '${child.typeName}' to 'Grid': expected x.GridChild`);
    }

    public override insertBefore(child: Node, _before: Node): void {
        this.appendChild(child);
    }

    public override removeChild(child: Node): void {
        if (child instanceof SlotNode) {
            super.removeChild(child);
            return;
        }

        if (isAttachable(child) && this.isGridChild(child)) {
            child.detachFrom(this);
            return;
        }

        throw new Error(`Cannot remove '${child.typeName}' from 'Grid': expected x.GridChild`);
    }
}

registerNodeClass(GridNode);
