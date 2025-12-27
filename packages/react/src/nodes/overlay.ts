import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { isContainerType } from "./internal/utils.js";
import { OverlayChildNode } from "./overlay-child.js";
import { WidgetNode } from "./widget.js";

class OverlayNode extends WidgetNode<Gtk.Overlay> {
    public static override priority = 1;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass): boolean {
        return isContainerType(Gtk.Overlay, containerOrClass);
    }

    public override appendChild(child: Node): void {
        if (child instanceof OverlayChildNode) {
            child.setParent(this.container);
            return;
        }

        if (!(child instanceof WidgetNode)) {
            super.appendChild(child);
            return;
        }

        if (!this.container.getChild()) {
            super.appendChild(child);
        } else {
            this.container.addOverlay(child.container);
        }
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof OverlayChildNode) {
            child.setParent(this.container);
            return;
        }

        if (!(child instanceof WidgetNode)) {
            super.insertBefore(child, before);
            return;
        }

        if (!this.container.getChild()) {
            super.insertBefore(child, before);
        } else {
            this.container.addOverlay(child.container);
        }
    }

    public override removeChild(child: Node): void {
        if (child instanceof OverlayChildNode) {
            child.setParent(undefined);
            return;
        }

        if (!(child instanceof WidgetNode)) {
            super.removeChild(child);
            return;
        }

        const currentChild = this.container.getChild();
        if (currentChild?.equals(child.container)) {
            this.container.setChild(undefined);
        } else {
            this.container.removeOverlay(child.container);
        }
    }
}

registerNodeClass(OverlayNode);
