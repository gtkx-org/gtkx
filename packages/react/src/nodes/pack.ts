import type * as Gtk from "@gtkx/ffi/gtk";
import { PACK_INTERFACE_METHODS } from "../generated/internal.js";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { matchesInterface } from "./internal/utils.js";
import { PackChild } from "./pack-child.js";
import { WidgetNode } from "./widget.js";

type PackableWidget = Gtk.Widget & {
    packStart(child: Gtk.Widget): void;
    packEnd(child: Gtk.Widget): void;
    remove(child: Gtk.Widget): void;
};

class PackNode extends WidgetNode<PackableWidget> {
    public static override priority = 0;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return matchesInterface(PACK_INTERFACE_METHODS, containerOrClass);
    }

    public override appendChild(child: Node): void {
        if (child instanceof PackChild) {
            child.setParent(this.container);
            return;
        }

        super.appendChild(child);
    }

    public override insertBefore(child: Node): void {
        this.appendChild(child);
    }

    public override removeChild(child: Node): void {
        if (child instanceof PackChild) {
            child.unmount();
            return;
        }

        super.removeChild(child);
    }
}

registerNodeClass(PackNode);
