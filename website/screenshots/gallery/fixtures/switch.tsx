import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkSwitch } from "@gtkx/jsx/gtk";
import { useState } from "react";

export const Demo = () => {
    const [enabled, setEnabled] = useState(true);

    return (
        <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
            <GtkLabel label="Dark mode" />
            <GtkSwitch
                active={enabled}
                onStateSet={(state) => {
                    setEnabled(state);
                    return false;
                }}
            />
        </GtkBox>
    );
};
