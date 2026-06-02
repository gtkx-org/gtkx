import type * as Adw from "@gtkx/gi/adw";
import type { AdjustableProps } from "../jsx.js";
import { AdjustmentController, adjustablePropDescriptors } from "./internal/adjustment.js";
import type { PropDescriptorTable } from "./internal/apply-props.js";
import { WidgetNode } from "./widget.js";

type SpinRowProps = AdjustableProps;

export class SpinRowNode extends WidgetNode<Adw.SpinRow, SpinRowProps> {
    private readonly adjustmentController = new AdjustmentController(this.backingInstance);

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            ...adjustablePropDescriptors(
                this.adjustmentController,
                () => this.props,
                "notify::value",
                () => this.backingInstance.getValue(),
            ),
        };
    }
}
