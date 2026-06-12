import { GtkSpinButton } from "@gtkx/jsx/gtk";
import { useAdjustment } from "@gtkx/react";

export const Demo = () => {
    const adjustment = useAdjustment({ value: 14, lower: 8, upper: 32, stepIncrement: 1 });

    return <GtkSpinButton adjustment={adjustment} climbRate={1} digits={0} />;
};
