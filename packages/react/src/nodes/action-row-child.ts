import type * as Gtk from "@gtkx/ffi/gtk";
import { VirtualContainerNode } from "./abstract/virtual-container.js";

type PrefixSuffixWidget = Gtk.Widget & {
    addPrefix(child: Gtk.Widget): void;
    addSuffix(child: Gtk.Widget): void;
    remove(child: Gtk.Widget): void;
};

export class ActionRowPrefixNode extends VirtualContainerNode<PrefixSuffixWidget> {
    protected override attachChild(parent: PrefixSuffixWidget, widget: Gtk.Widget): void {
        parent.addPrefix(widget);
    }
}

export class ActionRowSuffixNode extends VirtualContainerNode<PrefixSuffixWidget> {
    protected override attachChild(parent: PrefixSuffixWidget, widget: Gtk.Widget): void {
        parent.addSuffix(widget);
    }
}
