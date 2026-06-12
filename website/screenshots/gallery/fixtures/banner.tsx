import { AdwBanner } from "@gtkx/jsx/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <AdwBanner title="A new version is available" buttonLabel="Update" revealed />
        <GtkLabel label="Application content" vexpand cssClasses={["dim-label", "title-3"]} />
    </GtkBox>
);
