import * as Gtk from "@gtkx/gi/gtk";
import { GtkScale } from "@gtkx/jsx/gtk";
import { useAdjustment } from "@gtkx/react";

export const Demo = () => {
    const adjustment = useAdjustment({ value: 60, lower: 0, upper: 100, stepIncrement: 5 });

    return (
        <GtkScale
            hexpand
            drawValue
            adjustment={adjustment}
            marks={[
                { value: 0, position: Gtk.PositionType.BOTTOM, label: "Min" },
                { value: 50, position: Gtk.PositionType.BOTTOM, label: "50%" },
                { value: 100, position: Gtk.PositionType.BOTTOM, label: "Max" },
            ]}
        />
    );
};
