import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkLinkButton } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const LinkButtonDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Link GtkButtons" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="External Links" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLinkButton uri="https://gtk.org" label="GTK Website" />
                    <GtkLinkButton uri="https://gnome.org" label="GNOME Project" />
                    <GtkLinkButton uri="https://docs.gtk.org/gtk4/" label="GTK4 Documentation" />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="URI as GtkLabel" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLinkButton uri="https://gitlab.gnome.org/GNOME/gtk" />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="How It Works" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="<GtkLinkButton opens the URI in the default browser when clicked. It automatically tracks visited state."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const linkButtonDemo: Demo = {
    id: "link-button",
    title: "Link GtkButton",
    description: "Buttons that open URIs in the default browser.",
    keywords: ["link", "button", "uri", "url", "browser", "GtkLinkButton"],
    component: LinkButtonDemo,
    sourcePath: getSourcePath(import.meta.url, "link-button.tsx"),
};
