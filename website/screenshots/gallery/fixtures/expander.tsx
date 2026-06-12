import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkExpander, GtkLabel } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkExpander label="Advanced options" expanded>
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} marginTop={8}>
            <GtkLabel label="Cache size: 512 MB" halign={Gtk.Align.START} />
            <GtkLabel label="Renderer: cairo" halign={Gtk.Align.START} />
            <GtkLabel label="Animations: enabled" halign={Gtk.Align.START} />
        </GtkBox>
    </GtkExpander>
);
