import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkScale } from "@gtkx/jsx/gtk";

export const Demo = () => {
    return (
        <GtkScale
            hexpand
            drawValue
            adjustment={<GtkAdjustment value={60} lower={0} upper={100} stepIncrement={5} />}
            marks={[
                { value: 0, position: Gtk.PositionType.BOTTOM, label: "Min" },
                { value: 50, position: Gtk.PositionType.BOTTOM, label: "50%" },
                { value: 100, position: Gtk.PositionType.BOTTOM, label: "Max" },
            ]}
        />
    );
};
