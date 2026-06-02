import type * as Gtk from "@gtkx/gi/gtk";
import type { AdjustableProps } from "../jsx.js";
import { AdjustmentController, adjustablePropDescriptors } from "./internal/adjustment.js";
import type { PropDescriptorTable } from "./internal/apply-props.js";
import { WidgetNode } from "./widget.js";

/** Widgets the {@link AdjustableNode} reconciler node specializes. */
export type AdjustableWidget = Gtk.SpinButton | Gtk.ScaleButton | Gtk.Range;

export class AdjustableNode<T extends AdjustableWidget = AdjustableWidget> extends WidgetNode<T, AdjustableProps> {
    private readonly adjustmentController = new AdjustmentController(this.backingInstance);

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            ...adjustablePropDescriptors(
                this.adjustmentController,
                () => this.props,
                "value-changed",
                () => this.backingInstance.getValue(),
            ),
        };
    }
}
