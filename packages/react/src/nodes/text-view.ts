import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { isContainerType } from "./internal/utils.js";
import { TextBufferNode } from "./text-buffer.js";
import { WidgetNode } from "./widget.js";

class TextViewNode extends WidgetNode<Gtk.TextView> {
    public static override priority = 1;

    private bufferChild?: TextBufferNode;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return isContainerType(Gtk.TextView, containerOrClass);
    }

    public override appendChild(child: Node): void {
        if (this.tryAttachTextBuffer(child)) return;
        super.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (this.tryAttachTextBuffer(child)) return;
        super.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        if (child instanceof TextBufferNode) {
            if (this.bufferChild === child) {
                this.bufferChild = undefined;
            }
            return;
        }
        super.removeChild(child);
    }

    private tryAttachTextBuffer(child: Node): boolean {
        if (!(child instanceof TextBufferNode)) return false;

        if (this.bufferChild) {
            throw new Error("TextView can only have one TextBuffer child");
        }

        this.bufferChild = child;
        child.setTextView(this.container);
        return true;
    }
}

registerNodeClass(TextViewNode);
