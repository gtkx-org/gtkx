import type * as Adw from "@gtkx/ffi/adw";
import type { AdjustableProps } from "../jsx.js";
import { ADJUSTMENT_PROPS, AdjustmentController } from "./internal/adjustment.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { WidgetNode } from "./widget.js";

type SpinRowProps = AdjustableProps & {
    onValueChanged?: ((value: number) => void) | null;
};

export class SpinRowNode extends WidgetNode<Adw.SpinRow, SpinRowProps> {
    private readonly adjustmentController = new AdjustmentController(this.container);

    public override commitUpdate(oldProps: SpinRowProps | null, newProps: SpinRowProps): void {
        super.commitUpdate(
            oldProps ? filterProps(oldProps, ADJUSTMENT_PROPS) : null,
            filterProps(newProps, ADJUSTMENT_PROPS),
        );
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: SpinRowProps | null, newProps: SpinRowProps): void {
        if (hasChanged(oldProps, newProps, "onValueChanged")) {
            const { onValueChanged } = newProps;
            this.signalStore.set({
                owner: this,
                obj: this.container,
                signal: "notify::value",
                handler: onValueChanged ? () => onValueChanged(this.container.getValue()) : undefined,
            });
        }

        this.adjustmentController.apply(oldProps, newProps);
    }
}
