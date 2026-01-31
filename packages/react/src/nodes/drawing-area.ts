import type * as cairo from "@gtkx/ffi/cairo";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import { filterProps, hasChanged } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type DrawFunc = (self: Gtk.DrawingArea, cr: cairo.Context, width: number, height: number) => void;

type DrawingAreaProps = Props & {
    onDraw?: DrawFunc;
};

const OWN_PROPS = ["onDraw"] as const;

export class DrawingAreaNode extends WidgetNode<Gtk.DrawingArea, DrawingAreaProps> {
    private pendingDrawFunc: DrawFunc | null = null;

    public override updateProps(oldProps: DrawingAreaProps | null, newProps: DrawingAreaProps): void {
        super.updateProps(
            oldProps ? (filterProps(oldProps, OWN_PROPS) as DrawingAreaProps) : null,
            filterProps(newProps, OWN_PROPS) as DrawingAreaProps,
        );
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: DrawingAreaProps | null, newProps: DrawingAreaProps): void {
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
            const drawFunc = this.pendingDrawFunc;
            this.pendingDrawFunc = null;
            queueMicrotask(() => this.container.setDrawFunc(drawFunc));
        }
        this.signalStore.set(this, this.container, "realize", null);
    }
}
