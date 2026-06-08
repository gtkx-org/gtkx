import * as Gtk from "@gtkx/gi/gtk";
import { useLayoutEffect, useRef } from "react";

/** Initial configuration for a {@link useAdjustment} `Gtk.Adjustment`. */
export interface AdjustmentConfig {
    /** Initial value (default 0). */
    readonly value?: number;
    /** Minimum value (default 0). */
    readonly lower?: number;
    /** Maximum value (default 100). */
    readonly upper?: number;
    /** Step increment for small changes (default 1). */
    readonly stepIncrement?: number;
    /** Page increment for larger changes (default 10). */
    readonly pageIncrement?: number;
    /** Size of the visible page, for scrollbars (default 0). */
    readonly pageSize?: number;
}

/**
 * Creates and memoizes a `Gtk.Adjustment` for adjustable widgets
 * (`GtkScale`/`GtkRange`/`GtkSpinButton`/`GtkScaleButton`/`AdwSpinRow`), which
 * take a native `adjustment` prop rather than synthetic value/range props.
 *
 * The adjustment is created once (kept stable across renders through a ref) and
 * driven as a controlled object: any `config` field that changes between renders
 * is written back to it in a layout effect, so passing a changing `value` keeps
 * the adjustment in step with React state. Observe user-driven changes natively
 * (the widget's `value-changed` signal or `useProperty(adjustment, "value")`).
 *
 * @param config - Value, range, and increments.
 * @returns The stable, controlled `Gtk.Adjustment`.
 */
export function useAdjustment(config: AdjustmentConfig = {}): Gtk.Adjustment {
    const ref = useRef<Gtk.Adjustment | null>(null);
    if (!ref.current) {
        ref.current = Gtk.Adjustment.new(
            config.value ?? 0,
            config.lower ?? 0,
            config.upper ?? 100,
            config.stepIncrement ?? 1,
            config.pageIncrement ?? 10,
            config.pageSize ?? 0,
        );
    }
    const adjustment = ref.current;

    useLayoutEffect(() => {
        if (config.lower !== undefined) adjustment.setLower(config.lower);
        if (config.upper !== undefined) adjustment.setUpper(config.upper);
        if (config.stepIncrement !== undefined) adjustment.setStepIncrement(config.stepIncrement);
        if (config.pageIncrement !== undefined) adjustment.setPageIncrement(config.pageIncrement);
        if (config.pageSize !== undefined) adjustment.setPageSize(config.pageSize);
        if (config.value !== undefined) adjustment.setValue(config.value);
    }, [
        adjustment,
        config.value,
        config.lower,
        config.upper,
        config.stepIncrement,
        config.pageIncrement,
        config.pageSize,
    ]);

    return adjustment;
}
