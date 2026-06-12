import * as Gtk from "@gtkx/gi/gtk";
import { AdwStatusPage } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <AdwStatusPage
        vexpand
        iconName="document-edit-symbolic"
        title="No Notes Yet"
        description="Press + or Ctrl+N to create your first note"
    >
        <GtkButton label="New Note" halign={Gtk.Align.CENTER} cssClasses={["suggested-action", "pill"]} />
    </AdwStatusPage>
);
