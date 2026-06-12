import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLevelBar, GtkProgressBar, GtkSpinner } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16} hexpand>
        <GtkProgressBar fraction={0.7} showText text="Downloading… 70%" />
        <GtkLevelBar value={0.4} />
        <GtkSpinner spinning halign={Gtk.Align.CENTER} />
    </GtkBox>
);
