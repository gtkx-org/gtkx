import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";

export function AccentOverride() {
    return (
        <GtkBox
            spacing={12}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
        >
            <GtkButton label="Publish" cssClasses={["suggested-action"]} />
            <GtkBox
                style={{
                    "--accent-bg-color": "#26a269",
                    "--accent-color": "#1b8553",
                }}
            >
                <GtkButton label="Save" cssClasses={["suggested-action"]} />
            </GtkBox>
        </GtkBox>
    );
}
