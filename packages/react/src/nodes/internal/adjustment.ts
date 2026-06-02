import * as Gtk from "@gtkx/gi/gtk";
import type { AdjustableProps } from "../../jsx.js";
import { imperative, type PropDescriptorTable, signal } from "./apply-props.js";
import { hasChanged } from "./props.js";

type AdjustmentSyncer = (oldProps: AdjustableProps, newProps: AdjustableProps, adjustment: Gtk.Adjustment) => void;

const ADJUSTMENT_SYNCERS: readonly AdjustmentSyncer[] = [
    (oldProps, newProps, adjustment) => {
        if (hasChanged(oldProps, newProps, "lower")) adjustment.setLower(newProps.lower ?? 0);
    },
    (oldProps, newProps, adjustment) => {
        if (hasChanged(oldProps, newProps, "upper")) adjustment.setUpper(newProps.upper ?? 100);
    },
    (oldProps, newProps, adjustment) => {
        if (hasChanged(oldProps, newProps, "stepIncrement")) adjustment.setStepIncrement(newProps.stepIncrement ?? 1);
    },
    (oldProps, newProps, adjustment) => {
        if (hasChanged(oldProps, newProps, "pageIncrement")) adjustment.setPageIncrement(newProps.pageIncrement ?? 10);
    },
    (oldProps, newProps, adjustment) => {
        if (hasChanged(oldProps, newProps, "pageSize")) adjustment.setPageSize(newProps.pageSize ?? 0);
    },
    (oldProps, newProps, adjustment) => {
        if (hasChanged(oldProps, newProps, "value") && newProps.value !== undefined) {
            adjustment.setValue(newProps.value);
        }
    },
];

export class AdjustmentController {
    private adjustment: Gtk.Adjustment | null = null;

    constructor(private readonly backingInstance: { setAdjustment: (a: Gtk.Adjustment) => void }) {}

    apply(oldProps: AdjustableProps | null, newProps: AdjustableProps): void {
        if (!this.adjustment) {
            this.adjustment = this.createAdjustment(newProps);
            this.backingInstance.setAdjustment(this.adjustment);
            return;
        }

        if (oldProps) {
            this.syncChangedProps(oldProps, newProps, this.adjustment);
        }
    }

    private createAdjustment(props: AdjustableProps): Gtk.Adjustment {
        return Gtk.Adjustment.new(
            props.value ?? 0,
            props.lower ?? 0,
            props.upper ?? 100,
            props.stepIncrement ?? 1,
            props.pageIncrement ?? 10,
            props.pageSize ?? 0,
        );
    }

    private syncChangedProps(oldProps: AdjustableProps, newProps: AdjustableProps, adjustment: Gtk.Adjustment): void {
        for (const sync of ADJUSTMENT_SYNCERS) {
            sync(oldProps, newProps, adjustment);
        }
    }
}

/**
 * Builds the prop descriptors shared by every adjustment-backed widget: the
 * `value`/`lower`/`upper`/`stepIncrement`/`pageIncrement`/`pageSize` props
 * applied imperatively through `controller`, plus the value-changed signal.
 *
 * @param controller - The adjustment controller bound to the widget
 * @param currentProps - Reads the node's current props for the imperative apply
 * @param valueChangedSignal - The widget's value-changed signal name
 * @param readValue - Reads the widget's current value for the signal arguments
 * @returns The shared prop descriptor table
 */
export const adjustablePropDescriptors = (
    controller: AdjustmentController,
    currentProps: () => AdjustableProps,
    valueChangedSignal: string,
    readValue: () => number,
): PropDescriptorTable => {
    const applyAdjustment = imperative((oldProps) => controller.apply(oldProps, currentProps()), { always: true });
    return {
        onValueChanged: signal(valueChangedSignal, { getArgs: () => [readValue()] }),
        value: applyAdjustment,
        lower: applyAdjustment,
        upper: applyAdjustment,
        stepIncrement: applyAdjustment,
        pageIncrement: applyAdjustment,
        pageSize: applyAdjustment,
    };
};
