import type * as Gtk from "@gtkx/ffi/gtk";
import type { AdjustableProps } from "../jsx.js";
import { AdjustmentController } from "./internal/adjustment.js";
import { imperative, type PropDescriptorTable, signal } from "./internal/apply-props.js";
import { WidgetNode } from "./widget.js";

/** Widgets the {@link AdjustableNode} reconciler node specializes. */
export type AdjustableWidget = Gtk.SpinButton | Gtk.ScaleButton | Gtk.Range;

export class AdjustableNode<T extends AdjustableWidget = AdjustableWidget> extends WidgetNode<T, AdjustableProps> {
    private readonly adjustmentController = new AdjustmentController(this.container);

    protected override ownPropDescriptors(): PropDescriptorTable {
        const applyAdjustment = imperative(
            (oldProps) => {
                this.adjustmentController.apply(oldProps, this.props);
            },
            { always: true },
        );
        return {
            ...super.ownPropDescriptors(),
            onValueChanged: signal("value-changed", {
                getArgs: () => [this.container.getValue()],
            }),
            value: applyAdjustment,
            lower: applyAdjustment,
            upper: applyAdjustment,
            stepIncrement: applyAdjustment,
            pageIncrement: applyAdjustment,
            pageSize: applyAdjustment,
        };
    }
}
