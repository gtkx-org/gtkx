import type * as Gtk from "@gtkx/ffi/gtk";
import type { GtkDrawingAreaProps } from "../jsx.js";
import type { Node } from "../node.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import { imperative, type PropDescriptorTable } from "./internal/apply-props.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type DrawFunc = (cr: import("@gtkx/ffi/cairo").Context, width: number, height: number, self: Gtk.DrawingArea) => void;
type DrawingAreaProps = Pick<GtkDrawingAreaProps, "render">;
type DrawingAreaChild = EventControllerNode | SlotNode | ContainerSlotNode;

export class DrawingAreaNode extends WidgetNode<Gtk.DrawingArea, DrawingAreaProps, DrawingAreaChild> {
    private currentDrawFunc: DrawFunc | null = null;

    public override isValidChild(child: Node): boolean {
        return child instanceof EventControllerNode || child instanceof SlotNode || child instanceof ContainerSlotNode;
    }

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            render: imperative((oldProps) => {
                const hadDraw = !!(oldProps as DrawingAreaProps | null)?.render;
                const hasDraw = !!this.props.render;
                this.currentDrawFunc = this.props.render ?? null;

                if (hasDraw && !hadDraw) {
                    this.container.setDrawFunc((self, cr, width, height) => {
                        this.currentDrawFunc?.(cr, width, height, self);
                    });
                } else if (!hasDraw && hadDraw) {
                    this.container.setDrawFunc(null);
                } else if (hasDraw) {
                    this.container.queueDraw();
                }
            }),
        };
    }

    public override detachDeletedInstance(): void {
        if (this.currentDrawFunc !== null) {
            this.currentDrawFunc = null;
            this.container.setDrawFunc(null);
        }
        super.detachDeletedInstance();
    }
}
