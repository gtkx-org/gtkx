import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { PREFIX_SUFFIX_INTERFACE_METHODS } from "../reconciler-metadata.js";
import type { Container } from "../types.js";
import { VirtualContainerNode } from "./abstract/virtual-container.js";
import { matchesInterface } from "./internal/utils.js";

type PrefixSuffixWidget = Gtk.Widget & {
    addPrefix(child: Gtk.Widget): void;
    addSuffix(child: Gtk.Widget): void;
    remove(child: Gtk.Widget): void;
};

export class ActionRowPrefixNode extends VirtualContainerNode<PrefixSuffixWidget> {
    public override canBeChildOf(parent: Node): boolean {
        return matchesInterface(PREFIX_SUFFIX_INTERFACE_METHODS, parent.container as Container);
    }

    protected override attachChild(parent: PrefixSuffixWidget, widget: Gtk.Widget): void {
        parent.addPrefix(widget);
    }
}

export class ActionRowSuffixNode extends VirtualContainerNode<PrefixSuffixWidget> {
    public override canBeChildOf(parent: Node): boolean {
        return matchesInterface(PREFIX_SUFFIX_INTERFACE_METHODS, parent.container as Container);
    }

    protected override attachChild(parent: PrefixSuffixWidget, widget: Gtk.Widget): void {
        parent.addSuffix(widget);
    }
}
