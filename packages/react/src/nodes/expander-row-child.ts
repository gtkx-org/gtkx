import type * as Gtk from "@gtkx/ffi/gtk";
import { VirtualContainerNode } from "./abstract/virtual-container.js";

type ExpanderRowWidget = Gtk.Widget & {
    addRow(child: Gtk.Widget): void;
    addAction(child: Gtk.Widget): void;
    remove(child: Gtk.Widget): void;
};

export class ExpanderRowRowNode extends VirtualContainerNode<ExpanderRowWidget> {
    protected override attachChild(parent: ExpanderRowWidget, widget: Gtk.Widget): void {
        parent.addRow(widget);
    }
}

export class ExpanderRowActionNode extends VirtualContainerNode<ExpanderRowWidget> {
    protected override attachChild(parent: ExpanderRowWidget, widget: Gtk.Widget): void {
        parent.addAction(widget);
    }
}
