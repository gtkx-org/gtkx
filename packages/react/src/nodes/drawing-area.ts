import type * as cairo from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { filterProps, hasChanged, matchesAnyClass } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type DrawFunc = (self: Gtk.DrawingArea, cr: cairo.Context, width: number, height: number) => void;

type DrawingAreaProps = Props & {
    onDraw?: DrawFunc;
};

const OWN_PROPS = ["onDraw"] as const;

class DrawingAreaNode extends WidgetNode<Gtk.DrawingArea, DrawingAreaProps> {
    public static override priority = 1;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return matchesAnyClass([Gtk.DrawingArea], containerOrClass);
    }

    public override updateProps(oldProps: DrawingAreaProps | null, newProps: DrawingAreaProps): void {
        super.updateProps(
            oldProps ? (filterProps(oldProps, OWN_PROPS) as DrawingAreaProps) : null,
            filterProps(newProps, OWN_PROPS) as DrawingAreaProps,
        );
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: DrawingAreaProps | null, newProps: DrawingAreaProps): void {
        if (hasChanged(oldProps, newProps, "onDraw") && newProps.onDraw) {
            this.container.setDrawFunc(newProps.onDraw);
            this.container.queueDraw();
        }
    }
}

registerNodeClass(DrawingAreaNode);
