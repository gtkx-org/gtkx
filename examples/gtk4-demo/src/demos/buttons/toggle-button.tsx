import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, ToggleButton } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

export const ToggleButtonDemo = () => {
    const [bold, setBold] = useState(false);
    const [italic, setItalic] = useState(false);
    const [underline, setUnderline] = useState(false);

    const textStyle =
        [bold && "Bold", italic && "Italic", underline && "Underline"].filter(Boolean).join(" + ") || "Normal";

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Toggle Buttons" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Text Formatting Toolbar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={6} cssClasses={["linked"]}>
                    <ToggleButton.Root
                        label="B"
                        active={bold}
                        onToggled={() => setBold((v) => !v)}
                        cssClasses={["font-bold"]}
                    />
                    <ToggleButton.Root
                        label="I"
                        active={italic}
                        onToggled={() => setItalic((v) => !v)}
                        cssClasses={["font-italic"]}
                    />
                    <ToggleButton.Root label="U" active={underline} onToggled={() => setUnderline((v) => !v)} />
                </Box>
                <Label.Root label={`Current style: ${textStyle}`} cssClasses={["dim-label"]} />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Standalone Toggle" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <ToggleButton.Root label="Toggle Me" active={bold} onToggled={() => setBold((v) => !v)} />
            </Box>
        </Box>
    );
};

export const toggleButtonDemo: Demo = {
    id: "toggle-button",
    title: "Toggle Button",
    description: "Buttons that maintain an active/inactive state when clicked.",
    keywords: ["toggle", "button", "state", "GtkToggleButton"],
    component: ToggleButtonDemo,
    sourcePath: getSourcePath(import.meta.url, "toggle-button.tsx"),
};
