import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import type { AdjustableWidget } from "./internal/predicates.js";
import { filterProps, hasChanged } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["value", "lower", "upper", "stepIncrement", "pageIncrement", "pageSize", "onValueChanged"] as const;

type AdjustableProps = Props & {
    value?: number;
    lower?: number;
    upper?: number;
    stepIncrement?: number;
    pageIncrement?: number;
    pageSize?: number;
    onValueChanged?: ((value: number, self: AdjustableWidget) => void) | null;
};

export class AdjustableNode<T extends AdjustableWidget = AdjustableWidget> extends WidgetNode<T, AdjustableProps> {
    private adjustment: Gtk.Adjustment | null = null;

    protected override applyUpdate(oldProps: AdjustableProps | null, newProps: AdjustableProps): void {
        super.applyUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    protected ensureAdjustment(props: AdjustableProps): Gtk.Adjustment {
        if (!this.adjustment) {
            this.adjustment = new Gtk.Adjustment(
                props.value ?? 0,
                props.lower ?? 0,
                props.upper ?? 100,
                props.stepIncrement ?? 1,
                props.pageIncrement ?? 10,
                props.pageSize ?? 0,
            );
            this.container.setAdjustment(this.adjustment);
        }
        return this.adjustment;
    }

    protected applyOwnProps(oldProps: AdjustableProps | null, newProps: AdjustableProps): void {
        const adjustment = this.ensureAdjustment(newProps);

        if (hasChanged(oldProps, newProps, "onValueChanged")) {
            this.updateValueChangedHandler(newProps);
        }

        if (!oldProps) return;

        if (hasChanged(oldProps, newProps, "lower")) {
            adjustment.setLower(newProps.lower ?? 0);
        }
        if (hasChanged(oldProps, newProps, "upper")) {
            adjustment.setUpper(newProps.upper ?? 100);
        }
        if (hasChanged(oldProps, newProps, "stepIncrement")) {
            adjustment.setStepIncrement(newProps.stepIncrement ?? 1);
        }
        if (hasChanged(oldProps, newProps, "pageIncrement")) {
            adjustment.setPageIncrement(newProps.pageIncrement ?? 10);
        }
        if (hasChanged(oldProps, newProps, "pageSize")) {
            adjustment.setPageSize(newProps.pageSize ?? 0);
        }
        if (hasChanged(oldProps, newProps, "value") && newProps.value !== undefined) {
            adjustment.setValue(newProps.value);
        }
    }

    private updateValueChangedHandler(props: AdjustableProps): void {
        if (!this.adjustment) return;

        const { onValueChanged } = props;
        if (onValueChanged) {
            this.signalStore.set(this, this.container, "value-changed", (self: T) =>
                onValueChanged(self.getValue(), self),
            );
        } else {
            this.signalStore.set(this, this.container, "value-changed", null);
        }
    }
}
