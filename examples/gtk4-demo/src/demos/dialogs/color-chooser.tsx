import { getCurrentApp } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const ColorChooserDemo = () => {
    const [color, setColor] = useState<string | null>(null);

    const openColorDialog = async () => {
        const dialog = new Gtk.ColorDialog();
        dialog.setTitle("Choose a Color");
        dialog.setWithAlpha(true);

        try {
            const rgba = await dialog.chooseRgba(getCurrentApp().getActiveWindow() ?? undefined);
            const hex = `rgba(${Math.round(rgba.red * 255)}, ${Math.round(rgba.green * 255)}, ${Math.round(rgba.blue * 255)}, ${rgba.alpha.toFixed(2)})`;
            setColor(hex);
        } catch {
            setColor(null);
        }
    };

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Color Chooser" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Color Dialog" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="ColorDialog provides a modern color picker dialog with support for RGBA colors including alpha transparency."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Button label="Choose Color..." onClicked={openColorDialog} />
                    {color && <Label.Root label={color} cssClasses={["monospace"]} />}
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="How It Works" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="ColorDialog uses a Promise-based API. Call dialog.chooseRgba() and await the result. The dialog returns an RGBA struct with red, green, blue, and alpha values."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
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
