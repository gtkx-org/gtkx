import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={10} halign={Gtk.Align.CENTER}>
        <GtkBox spacing={8}>
            <GtkButton label="Regular" />
            <GtkButton label="Suggested" cssClasses={["suggested-action"]} />
            <GtkButton label="Destructive" cssClasses={["destructive-action"]} />
        </GtkBox>
        <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
            <GtkButton label="Pill" cssClasses={["pill"]} />
            <GtkButton iconName="document-edit-symbolic" />
            <GtkButton iconName="user-trash-symbolic" cssClasses={["flat"]} />
        </GtkBox>
    </GtkBox>
);
