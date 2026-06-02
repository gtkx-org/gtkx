import type * as Gtk from "@gtkx/gi/gtk";
import { Node } from "../node.js";
import type { Props } from "../types.js";
import { unparentWidget } from "./internal/widget.js";
import { WidgetNode } from "./widget.js";

export class ListItemNode extends Node<Gtk.ListItem | Gtk.ListHeader, Props, Node, Node> {
    public override isValidChild(_child: Node): boolean {
        return true;
    }

    public override appendChild(child: Node): void {
        super.appendChild(child);

        if (child instanceof WidgetNode) {
            unparentWidget(child.backingInstance);
            this.backingInstance.setChild(child.backingInstance);
        }
    }

    public override removeChild(child: Node): void {
        if (child instanceof WidgetNode) {
            this.backingInstance.setChild(null);
        }

        super.removeChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        super.insertBefore(child, before);

        if (child instanceof WidgetNode) {
            unparentWidget(child.backingInstance);
            this.backingInstance.setChild(child.backingInstance);
        }
    }
}
