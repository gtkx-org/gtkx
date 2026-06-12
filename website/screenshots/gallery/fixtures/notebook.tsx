import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkNotebook, GtkNotebookPage } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkNotebook>
        <GtkNotebookPage label="General">
            <GtkLabel label="General settings" valign={Gtk.Align.CENTER} vexpand cssClasses={["title-3"]} />
        </GtkNotebookPage>
        <GtkNotebookPage label="Appearance">
            <GtkLabel label="Appearance settings" valign={Gtk.Align.CENTER} vexpand cssClasses={["title-3"]} />
        </GtkNotebookPage>
        <GtkNotebookPage label="Advanced">
            <GtkLabel label="Advanced settings" valign={Gtk.Align.CENTER} vexpand cssClasses={["title-3"]} />
        </GtkNotebookPage>
    </GtkNotebook>
);
