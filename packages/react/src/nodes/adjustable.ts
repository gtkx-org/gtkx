import * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { type AdjustableWidget, isAdjustable } from "./internal/predicates.js";
import { signalStore } from "./internal/signal-store.js";
import { isContainerType } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type AdjustableProps = Props & {
    value?: number;
    lower?: number;
    upper?: number;
    stepIncrement?: number;
    pageIncrement?: number;
    pageSize?: number;
    onValueChanged?: ((value: number) => void) | null;
};

export class AdjustableNode<T extends Gtk.Widget = Gtk.Widget> extends WidgetNode<T, AdjustableProps> {
    public static override priority = 2;

    private adjustment?: Gtk.Adjustment;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return isContainerType(Gtk.Widget, containerOrClass) && isAdjustable(containerOrClass);
    }

    public override updateProps(oldProps: AdjustableProps | null, newProps: AdjustableProps): void {
        super.updateProps(oldProps, newProps);
        this.updateAdjustment(oldProps, newProps);
    }

    private updateAdjustment(oldProps: AdjustableProps | null, newProps: AdjustableProps): void {
        if (!this.adjustment) {
            this.adjustment = new Gtk.Adjustment(
                newProps.value ?? 0,
                newProps.lower ?? 0,
                newProps.upper ?? 100,
                newProps.stepIncrement ?? 1,
                newProps.pageIncrement ?? 10,
                newProps.pageSize ?? 0,
            );
            (this.container as unknown as AdjustableWidget).setAdjustment(this.adjustment);
            this.updateValueChangedHandler(newProps);
            return;
        }

        if (!oldProps || oldProps.lower !== newProps.lower) {
            this.adjustment.setLower(newProps.lower ?? 0);
        }
        if (!oldProps || oldProps.upper !== newProps.upper) {
            this.adjustment.setUpper(newProps.upper ?? 100);
        }
        if (!oldProps || oldProps.stepIncrement !== newProps.stepIncrement) {
            this.adjustment.setStepIncrement(newProps.stepIncrement ?? 1);
        }
        if (!oldProps || oldProps.pageIncrement !== newProps.pageIncrement) {
            this.adjustment.setPageIncrement(newProps.pageIncrement ?? 10);
        }
        if (!oldProps || oldProps.pageSize !== newProps.pageSize) {
            this.adjustment.setPageSize(newProps.pageSize ?? 0);
        }
        if (!oldProps || oldProps.value !== newProps.value) {
            if (newProps.value !== undefined) {
                this.adjustment.setValue(newProps.value);
            }
        }

        if (!oldProps || oldProps.onValueChanged !== newProps.onValueChanged) {
            this.updateValueChangedHandler(newProps);
        }
    }

    private updateValueChangedHandler(props: AdjustableProps): void {
        if (!this.adjustment) return;

        const { onValueChanged } = props;
        if (onValueChanged) {
            const adjustment = this.adjustment;
            signalStore.set(this, adjustment, "value-changed", () => onValueChanged(adjustment.getValue()));
        } else {
            signalStore.set(this, this.adjustment, "value-changed", null);
        }
    }
}

registerNodeClass(AdjustableNode);
