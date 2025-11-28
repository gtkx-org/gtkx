import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, LinkButton } from "@gtkx/react";
import type { Demo } from "../types.js";

export const LinkButtonDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Link Buttons" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="External Links" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <LinkButton uri="https://gtk.org" label="GTK Website" />
                    <LinkButton uri="https://gnome.org" label="GNOME Project" />
                    <LinkButton uri="https://docs.gtk.org/gtk4/" label="GTK4 Documentation" />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="URI as Label" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <LinkButton uri="https://gitlab.gnome.org/GNOME/gtk" />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="How It Works" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="LinkButton opens the URI in the default browser when clicked. It automatically tracks visited state."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};

export const linkButtonDemo: Demo = {
    id: "link-button",
    title: "Link Button",
    description: "Buttons that open URIs in the default browser.",
    keywords: ["link", "button", "uri", "url", "browser", "GtkLinkButton"],
    component: LinkButtonDemo,
    source: `import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, LinkButton } from "@gtkx/react";

export const LinkButtonDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Link Buttons" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="External Links" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <LinkButton uri="https://gtk.org" label="GTK Website" />
                    <LinkButton uri="https://gnome.org" label="GNOME Project" />
                    <LinkButton uri="https://docs.gtk.org/gtk4/" label="GTK4 Documentation" />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="URI as Label" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <LinkButton uri="https://gitlab.gnome.org/GNOME/gtk" />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="How It Works" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="LinkButton opens the URI in the default browser when clicked. It automatically tracks visited state."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};`,
};
