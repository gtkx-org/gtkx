import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkScrolledWindowProps } from "../jsx.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["hscrollbarPolicy", "vscrollbarPolicy"] as const;

type ScrolledWindowProps = Pick<GtkScrolledWindowProps, (typeof OWN_PROPS)[number]>;

export class ScrolledWindowNode extends WidgetNode<Gtk.ScrolledWindow, ScrolledWindowProps> {
    public override commitUpdate(oldProps: ScrolledWindowProps | null, newProps: ScrolledWindowProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: ScrolledWindowProps | null, newProps: ScrolledWindowProps): void {
        if (hasChanged(oldProps, newProps, "hscrollbarPolicy") || hasChanged(oldProps, newProps, "vscrollbarPolicy")) {
            const hPolicy = newProps.hscrollbarPolicy ?? Gtk.PolicyType.AUTOMATIC;
            const vPolicy = newProps.vscrollbarPolicy ?? Gtk.PolicyType.AUTOMATIC;
            this.container.setPolicy(hPolicy, vPolicy);
        }
    }
}
