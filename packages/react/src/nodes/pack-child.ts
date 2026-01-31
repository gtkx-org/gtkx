import type * as Gtk from "@gtkx/ffi/gtk";
import { VirtualContainerNode } from "./abstract/virtual-container.js";

type PackableWidget = Gtk.Widget & {
    packStart(child: Gtk.Widget): void;
    packEnd(child: Gtk.Widget): void;
    remove(child: Gtk.Widget): void;
};

export class PackStartNode extends VirtualContainerNode<PackableWidget> {
    protected override attachChild(parent: PackableWidget, widget: Gtk.Widget): void {
        parent.packStart(widget);
    }
}

export class PackEndNode extends VirtualContainerNode<PackableWidget> {
    protected override attachChild(parent: PackableWidget, widget: Gtk.Widget): void {
        parent.packEnd(widget);
    }
}
