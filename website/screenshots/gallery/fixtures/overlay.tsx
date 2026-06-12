import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkOverlay, GtkOverlayChild } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkOverlay>
        <GtkLabel label="Base content" widthRequest={320} heightRequest={200} cssClasses={["title-2", "dim-label"]} />
        <GtkOverlayChild>
            <GtkLabel
                label="3 unread"
                halign={Gtk.Align.END}
                valign={Gtk.Align.START}
                marginTop={12}
                marginEnd={12}
                cssClasses={["pill", "accent"]}
            />
        </GtkOverlayChild>
    </GtkOverlay>
);
