import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import { filterProps, hasChanged } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

const PROPS = ["hscrollbarPolicy", "vscrollbarPolicy"] as const;

type ScrolledWindowProps = Props & {
    hscrollbarPolicy?: Gtk.PolicyType;
    vscrollbarPolicy?: Gtk.PolicyType;
};

export class ScrolledWindowNode extends WidgetNode<Gtk.ScrolledWindow, ScrolledWindowProps> {
    protected override applyUpdate(oldProps: ScrolledWindowProps | null, newProps: ScrolledWindowProps): void {
        super.applyUpdate(oldProps ? filterProps(oldProps, PROPS) : null, filterProps(newProps, PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: ScrolledWindowProps | null, newProps: ScrolledWindowProps): void {
        if (hasChanged(oldProps, newProps, "hscrollbarPolicy") || hasChanged(oldProps, newProps, "vscrollbarPolicy")) {
            const hPolicy = newProps.hscrollbarPolicy ?? Gtk.PolicyType.AUTOMATIC;
            const vPolicy = newProps.vscrollbarPolicy ?? Gtk.PolicyType.AUTOMATIC;
            this.container.setPolicy(hPolicy, vPolicy);
        }
    }
}
