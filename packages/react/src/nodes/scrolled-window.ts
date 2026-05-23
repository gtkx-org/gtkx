import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkScrolledWindowProps } from "../jsx.js";
import { imperative, type PropDescriptorTable } from "./internal/apply-props.js";
import { WidgetNode } from "./widget.js";

type ScrolledWindowProps = Pick<GtkScrolledWindowProps, "hscrollbarPolicy" | "vscrollbarPolicy">;

export class ScrolledWindowNode extends WidgetNode<Gtk.ScrolledWindow, ScrolledWindowProps> {
    protected override ownPropDescriptors(): PropDescriptorTable {
        const applyPolicy = imperative(() => {
            this.container.setPolicy(
                this.props.hscrollbarPolicy ?? Gtk.PolicyType.AUTOMATIC,
                this.props.vscrollbarPolicy ?? Gtk.PolicyType.AUTOMATIC,
            );
        });
        return {
            ...super.ownPropDescriptors(),
            hscrollbarPolicy: applyPolicy,
            vscrollbarPolicy: applyPolicy,
        };
    }
}
