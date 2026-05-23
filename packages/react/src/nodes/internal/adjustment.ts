import * as Gtk from "@gtkx/ffi/gtk";
import type { AdjustableProps } from "../../jsx.js";
import { hasChanged } from "./props.js";

export const ADJUSTMENT_PROPS = [
    "value",
    "lower",
    "upper",
    "stepIncrement",
    "pageIncrement",
    "pageSize",
    "onValueChanged",
] as const;

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

    constructor(private readonly container: { setAdjustment: (a: Gtk.Adjustment) => void }) {}

    apply(oldProps: AdjustableProps | null, newProps: AdjustableProps): Gtk.Adjustment {
        if (!this.adjustment) {
            this.adjustment = this.createAdjustment(newProps);
            this.container.setAdjustment(this.adjustment);
            return this.adjustment;
        }

        if (oldProps) {
            this.syncChangedProps(oldProps, newProps, this.adjustment);
        }
        return this.adjustment;
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
