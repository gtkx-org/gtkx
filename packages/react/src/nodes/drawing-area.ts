import type * as Gtk from "@gtkx/ffi/gtk";
import type { GtkDrawingAreaProps } from "../jsx.js";
import type { Node } from "../node.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["render"] as const;

type DrawFunc = (cr: import("@gtkx/ffi/cairo").Context, width: number, height: number, self: Gtk.DrawingArea) => void;
type DrawingAreaProps = Pick<GtkDrawingAreaProps, (typeof OWN_PROPS)[number]>;

function wrapDrawFunc(
    fn: DrawFunc,
): (self: Gtk.DrawingArea, cr: import("@gtkx/ffi/cairo").Context, width: number, height: number) => void {
    return (self, cr, width, height) => fn(cr, width, height, self);
}

type DrawingAreaChild = EventControllerNode | SlotNode | ContainerSlotNode;

export class DrawingAreaNode extends WidgetNode<Gtk.DrawingArea, DrawingAreaProps, DrawingAreaChild> {
    public override isValidChild(child: Node): boolean {
        return child instanceof EventControllerNode || child instanceof SlotNode || child instanceof ContainerSlotNode;
    }

    public override commitUpdate(oldProps: DrawingAreaProps | null, newProps: DrawingAreaProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        this.container.setDrawFunc(undefined);
        super.detachDeletedInstance();
    }

    private applyOwnProps(oldProps: DrawingAreaProps | null, newProps: DrawingAreaProps): void {
        if (hasChanged(oldProps, newProps, "render")) {
            this.container.setDrawFunc(newProps.render ? wrapDrawFunc(newProps.render) : undefined);
            if (newProps.render) {
                this.container.queueDraw();
            }
        }
    }
}
