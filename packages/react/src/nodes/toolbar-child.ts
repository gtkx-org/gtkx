import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { VirtualContainerNode } from "./abstract/virtual-container.js";

export class ToolbarTopNode extends VirtualContainerNode<Adw.ToolbarView> {
    protected override attachChild(parent: Adw.ToolbarView, widget: Gtk.Widget): void {
        parent.addTopBar(widget);
    }
}

export class ToolbarBottomNode extends VirtualContainerNode<Adw.ToolbarView> {
    protected override attachChild(parent: Adw.ToolbarView, widget: Gtk.Widget): void {
        parent.addBottomBar(widget);
    }
}
