import type * as cairo from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { filterProps, isContainerType } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type DrawFunc = (self: Gtk.DrawingArea, cr: cairo.Context, width: number, height: number) => void;

const PROPS = ["onDraw"];

interface DrawingAreaProps extends Props {
    onDraw?: DrawFunc;
}

class DrawingAreaNode extends WidgetNode<Gtk.DrawingArea, DrawingAreaProps> {
    public static override priority = 1;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return isContainerType(Gtk.DrawingArea, containerOrClass);
    }

    public override updateProps(oldProps: DrawingAreaProps | null, newProps: DrawingAreaProps): void {
        if (newProps.onDraw && (!oldProps || oldProps.onDraw !== newProps.onDraw)) {
            this.container.setDrawFunc(newProps.onDraw);
            this.container.queueDraw();
        }

        super.updateProps(filterProps(oldProps ?? {}, PROPS), filterProps(newProps, PROPS));
    }
}

registerNodeClass(DrawingAreaNode);
