import type * as cairo from "@gtkx/ffi/cairo";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { GtkDrawingAreaProps } from "../jsx.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["onDraw"] as const;

type DrawFunc = (self: Gtk.DrawingArea, cr: cairo.Context, width: number, height: number) => void;
type DrawingAreaProps = Pick<GtkDrawingAreaProps, (typeof OWN_PROPS)[number]>;

export class DrawingAreaNode extends WidgetNode<Gtk.DrawingArea, DrawingAreaProps> {
    private pendingDrawFunc: DrawFunc | null = null;

    public override commitUpdate(oldProps: DrawingAreaProps | null, newProps: DrawingAreaProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: DrawingAreaProps | null, newProps: DrawingAreaProps): void {
        if (hasChanged(oldProps, newProps, "onDraw") && newProps.onDraw) {
            if (this.container.getRealized()) {
                this.container.setDrawFunc(newProps.onDraw);
            } else {
                this.pendingDrawFunc = newProps.onDraw;
                this.signalStore.set(this, this.container, "realize", this.onRealize.bind(this));
            }
        }
    }

    private onRealize(): void {
        if (this.pendingDrawFunc) {
            this.container.setDrawFunc(this.pendingDrawFunc);
            this.pendingDrawFunc = null;
        }
        this.signalStore.set(this, this.container, "realize", undefined);
    }
}
