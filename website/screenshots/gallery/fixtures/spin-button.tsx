import { GtkAdjustment, GtkSpinButton } from "@gtkx/jsx/gtk";

export const Demo = () => {
    return (
        <GtkSpinButton
            adjustment={<GtkAdjustment value={14} lower={8} upper={32} stepIncrement={1} />}
            climbRate={1}
            digits={0}
        />
    );
};
