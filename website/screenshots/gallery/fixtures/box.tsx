import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
        <GtkLabel label="Boxes stack children" cssClasses={["title-4"]} />
        <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
            <GtkButton label="One" />
            <GtkButton label="Two" />
            <GtkButton label="Three" />
        </GtkBox>
        <GtkLabel label="vertically or horizontally" cssClasses={["dim-label"]} />
    </GtkBox>
);
