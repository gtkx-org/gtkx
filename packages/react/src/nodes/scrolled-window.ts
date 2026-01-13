import * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { filterProps, isContainerType } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

const PROPS = ["hscrollbarPolicy", "vscrollbarPolicy"];

type ScrolledWindowProps = Props & {
    hscrollbarPolicy?: Gtk.PolicyType;
    vscrollbarPolicy?: Gtk.PolicyType;
};

export class ScrolledWindowNode extends WidgetNode<Gtk.ScrolledWindow, ScrolledWindowProps> {
    public static override priority = 2;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return isContainerType(Gtk.ScrolledWindow, containerOrClass);
    }

    public override updateProps(oldProps: ScrolledWindowProps | null, newProps: ScrolledWindowProps): void {
        if (
            oldProps?.hscrollbarPolicy !== newProps.hscrollbarPolicy ||
            oldProps?.vscrollbarPolicy !== newProps.vscrollbarPolicy
        ) {
            const hPolicy = newProps.hscrollbarPolicy ?? Gtk.PolicyType.AUTOMATIC;
            const vPolicy = newProps.vscrollbarPolicy ?? Gtk.PolicyType.AUTOMATIC;
            this.container.setPolicy(hPolicy, vPolicy);
        }

        super.updateProps(filterProps(oldProps ?? {}, PROPS), filterProps(newProps, PROPS));
    }
}

registerNodeClass(ScrolledWindowNode);
