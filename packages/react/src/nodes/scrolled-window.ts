import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import { hasChanged } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

const PROPS = ["hscrollbarPolicy", "vscrollbarPolicy"] as const;

type ScrolledWindowProps = Props & {
    hscrollbarPolicy?: Gtk.PolicyType;
    vscrollbarPolicy?: Gtk.PolicyType;
};

export class ScrolledWindowNode extends WidgetNode<Gtk.ScrolledWindow, ScrolledWindowProps> {
    protected override readonly excludedPropNames = PROPS;

    public override commitUpdate(oldProps: ScrolledWindowProps | null, newProps: ScrolledWindowProps): void {
        super.commitUpdate(oldProps, newProps);
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
