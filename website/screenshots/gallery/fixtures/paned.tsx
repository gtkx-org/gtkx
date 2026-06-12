import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkPaned } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkPaned
        orientation={Gtk.Orientation.HORIZONTAL}
        position={200}
        startChild={<GtkLabel label="Sidebar" cssClasses={["dim-label"]} />}
        endChild={<GtkLabel label="Content" cssClasses={["title-3"]} />}
    />
);
