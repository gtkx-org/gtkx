import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/react";
import { AppShell } from "../AppShell";

export const Chapter1 = () => (
    <AppShell headerStart={<GtkButton iconName="list-add-symbolic" />}>
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={12}
            vexpand
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
        >
            <GtkLabel label="No notes yet" cssClasses={["dim-label", "title-3"]} />
        </GtkBox>
    </AppShell>
);
