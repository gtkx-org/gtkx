import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { PACK_INTERFACE_METHODS } from "../reconciler-metadata.js";
import type { Container } from "../types.js";
import { VirtualContainerNode } from "./abstract/virtual-container.js";
import { matchesInterface } from "./internal/utils.js";

type PackableWidget = Gtk.Widget & {
    packStart(child: Gtk.Widget): void;
    packEnd(child: Gtk.Widget): void;
    remove(child: Gtk.Widget): void;
};

export class PackStartNode extends VirtualContainerNode<PackableWidget> {
    public override canBeChildOf(parent: Node): boolean {
        return matchesInterface(PACK_INTERFACE_METHODS, parent.container as Container);
    }

    protected override attachChild(parent: PackableWidget, widget: Gtk.Widget): void {
        parent.packStart(widget);
    }
}

export class PackEndNode extends VirtualContainerNode<PackableWidget> {
    public override canBeChildOf(parent: Node): boolean {
        return matchesInterface(PACK_INTERFACE_METHODS, parent.container as Container);
    }

    protected override attachChild(parent: PackableWidget, widget: Gtk.Widget): void {
        parent.packEnd(widget);
    }
}
