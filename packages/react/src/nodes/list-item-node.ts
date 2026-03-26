import type * as Gtk from "@gtkx/ffi/gtk";
import { Node } from "../node.js";
import type { Container, Props } from "../types.js";
import { WidgetNode } from "./widget.js";

export class ListItemNode extends Node<Gtk.ListItem | Gtk.ListHeader, Props, Node, Node> {
    public override isValidChild(_child: Node): boolean {
        return true;
    }

    public override appendChild(child: Node): void {
        super.appendChild(child);

        if (child instanceof WidgetNode) {
            this.container.setChild(child.container);
        }
    }

    public override removeChild(child: Node): void {
        if (child instanceof WidgetNode) {
            this.container.setChild(null);
        }

        super.removeChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        super.insertBefore(child, before);

        if (child instanceof WidgetNode) {
            this.container.setChild(child.container);
        }
    }

    public static override createContainer(): Container {
        throw new Error("ListItemNode does not support container creation");
    }
}
