import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkFrame, GtkLabel } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkFrame label="Connection">
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
            marginTop={12}
            marginBottom={12}
            marginStart={12}
            marginEnd={12}
        >
            <GtkLabel label="Host: gtkx.dev" halign={Gtk.Align.START} />
            <GtkLabel label="Status: connected" halign={Gtk.Align.START} cssClasses={["dim-label"]} />
        </GtkBox>
    </GtkFrame>
);
