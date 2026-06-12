import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkEntry, GtkPasswordEntry, GtkSearchEntry } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={10}>
        <GtkEntry placeholderText="Display name" />
        <GtkPasswordEntry placeholderText="Password" showPeekIcon />
        <GtkSearchEntry placeholderText="Search notes…" />
        <GtkEntry text="gtkx.dev" primaryIconName="network-server-symbolic" />
    </GtkBox>
);
