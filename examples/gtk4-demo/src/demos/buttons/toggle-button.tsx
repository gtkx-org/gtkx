import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkToggleButton } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const ToggleButtonDemo = () => {
    const [bold, setBold] = useState(false);
    const [italic, setItalic] = useState(false);
    const [underline, setUnderline] = useState(false);

    const textStyle =
        [bold && "Bold", italic && "Italic", underline && "Underline"].filter(Boolean).join(" + ") || "Normal";

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Toggle GtkButtons" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Text Formatting Toolbar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={6} cssClasses={["linked"]}>
                    <GtkToggleButton
                        label="B"
                        active={bold}
                        onToggled={() => setBold((v) => !v)}
                        cssClasses={["font-bold"]}
                    />
                    <GtkToggleButton
                        label="I"
                        active={italic}
                        onToggled={() => setItalic((v) => !v)}
                        cssClasses={["font-italic"]}
                    />
                    <GtkToggleButton label="U" active={underline} onToggled={() => setUnderline((v) => !v)} />
                </GtkBox>
                <GtkLabel label={`Current style: ${textStyle}`} cssClasses={["dim-label"]} />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Standalone Toggle" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkToggleButton label="Toggle Me" active={bold} onToggled={() => setBold((v) => !v)} />
            </GtkBox>
        </GtkBox>
    );
};

export const toggleButtonDemo: Demo = {
    id: "toggle-button",
    title: "Toggle GtkButton",
    description: "Buttons that maintain an active/inactive state when clicked.",
    keywords: ["toggle", "button", "state", "GtkToggleButton"],
    component: ToggleButtonDemo,
    sourcePath: getSourcePath(import.meta.url, "toggle-button.tsx"),
};
