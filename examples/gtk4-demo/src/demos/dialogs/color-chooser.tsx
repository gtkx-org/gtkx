import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, useApplication } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const ColorChooserDemo = () => {
    const app = useApplication();
    const [color, setColor] = useState<string | null>(null);

    const openColorDialog = async () => {
        const dialog = new Gtk.ColorDialog();
        dialog.setTitle("Choose a Color");
        dialog.setWithAlpha(true);

        try {
            const rgba = await dialog.chooseRgba(app.getActiveWindow() ?? undefined);
            const hex = `rgba(${Math.round(rgba.red * 255)}, ${Math.round(rgba.green * 255)}, ${Math.round(rgba.blue * 255)}, ${rgba.alpha.toFixed(2)})`;
            setColor(hex);
        } catch {
            setColor(null);
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Color Chooser" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Color Dialog" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="ColorDialog provides a modern color picker dialog with support for RGBA colors including alpha transparency."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkButton label="Choose Color..." onClicked={openColorDialog} />
                    {color && <GtkLabel label={color} cssClasses={["monospace"]} />}
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="How It Works" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="ColorDialog uses a Promise-based API. Call dialog.chooseRgba() and await the result. The dialog returns an RGBA struct with red, green, blue, and alpha values."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const colorChooserDemo: Demo = {
    id: "color-chooser",
    title: "Color Chooser",
    description: "Color selection dialog with RGBA support.",
    keywords: ["color", "chooser", "picker", "rgba", "GtkColorDialog"],
    component: ColorChooserDemo,
    sourcePath: getSourcePath(import.meta.url, "color-chooser.tsx"),
};
