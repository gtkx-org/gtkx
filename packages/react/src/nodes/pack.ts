import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { PackChild } from "./pack-child.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

export type PackableWidget = Gtk.Widget & {
    packStart(child: Gtk.Widget): void;
    packEnd(child: Gtk.Widget): void;
    remove(child: Gtk.Widget): void;
};

class PackNode extends WidgetNode<PackableWidget> {
    public static override priority = 0;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass): boolean {
        if (
            !containerOrClass ||
            (typeof containerOrClass !== "function" && !(containerOrClass instanceof Gtk.Widget))
        ) {
            return false;
        }

        const protoOrInstance = typeof containerOrClass === "function" ? containerOrClass.prototype : containerOrClass;
        return "packStart" in protoOrInstance && "packEnd" in protoOrInstance && "remove" in protoOrInstance;
    }

    public override appendChild(child: Node): void {
        if (child instanceof PackChild) {
            child.setParent(this.container);
            return;
        }

        if (child instanceof SlotNode) {
            child.setParent(this.container);
            return;
        }

        if (child instanceof WidgetNode) {
            this.container.packStart(child.container);
            return;
        }

        throw new Error(`Cannot append '${child.typeName}' to 'PackedContainer': expected PackChild`);
    }

    public override insertBefore(child: Node): void {
        this.appendChild(child);
    }

    public override removeChild(child: Node): void {
        if (child instanceof PackChild) {
            child.setParent(undefined);
            return;
        }

        if (child instanceof SlotNode) {
            child.setParent(undefined);
            return;
        }

        if (child instanceof WidgetNode) {
            this.container.remove(child.container);
            return;
        }

        throw new Error(`Cannot remove '${child.typeName}' from 'PackedContainer': expected PackChild`);
    }
}

registerNodeClass(PackNode);
