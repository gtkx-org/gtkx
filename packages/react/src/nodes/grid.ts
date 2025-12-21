import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { GridChildNode } from "./grid-child.js";
import { isContainerType } from "./internal/helpers.js";
import { WidgetNode } from "./widget.js";

export class GridNode extends WidgetNode<Gtk.Grid> {
    public static override priority = 1;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass): boolean {
        return isContainerType(Gtk.Grid, containerOrClass);
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof GridChildNode)) {
            throw new Error(`Cannot append child of type ${child.typeName} to Grid`);
        }

        child.setGrid(this.container);
    }

    public override insertBefore(child: Node, _before: Node): void {
        this.appendChild(child);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof GridChildNode)) {
            throw new Error(`Cannot remove child of type ${child.typeName} from Grid`);
        }

        child.setGrid(undefined);
    }
}

registerNodeClass(GridNode);
