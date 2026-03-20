import type * as Gtk from "@gtkx/ffi/gtk";
import type { GtkDrawingAreaProps } from "../jsx.js";
import type { Node } from "../node.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["onDraw"] as const;

type DrawFunc = (cr: import("@gtkx/ffi/cairo").Context, width: number, height: number, self: Gtk.DrawingArea) => void;
type DrawingAreaProps = Pick<GtkDrawingAreaProps, (typeof OWN_PROPS)[number]>;

type PendingDrawFuncEntry = { container: Gtk.DrawingArea; fn: DrawFunc };

const pendingDrawFuncs: PendingDrawFuncEntry[] = [];

function wrapDrawFunc(
    fn: DrawFunc,
): (self: Gtk.DrawingArea, cr: import("@gtkx/ffi/cairo").Context, width: number, height: number) => void {
    return (self, cr, width, height) => fn(cr, width, height, self);
}

function ensurePendingBatch(): PendingDrawFuncEntry[] {
    if (pendingDrawFuncs.length === 0) {
        queueMicrotask(flushPendingDrawFuncs);
    }

    return pendingDrawFuncs;
}

function flushPendingDrawFuncs(): void {
    const batch = pendingDrawFuncs.splice(0);

    for (const { container, fn } of batch) {
        container.setDrawFunc(wrapDrawFunc(fn));
    }
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

    private applyOwnProps(oldProps: DrawingAreaProps | null, newProps: DrawingAreaProps): void {
        if (hasChanged(oldProps, newProps, "onDraw")) {
            if (this.container.getAllocatedWidth() > 0) {
                this.container.setDrawFunc(newProps.onDraw ? wrapDrawFunc(newProps.onDraw) : undefined);
            } else if (newProps.onDraw) {
                ensurePendingBatch().push({ container: this.container, fn: newProps.onDraw });
            }
        }
    }
}
