import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkCheckButton, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const CheckButtonDemo = () => {
    const [option1, setOption1] = useState(false);
    const [option2, setOption2] = useState(true);
    const [option3, setOption3] = useState(false);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Check GtkButtons" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Independent Checkboxes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkCheckButton label="Option 1" active={option1} onToggled={() => setOption1((v) => !v)} />
                    <GtkCheckButton
                        label="Option 2 (initially checked)"
                        active={option2}
                        onToggled={() => setOption2((v) => !v)}
                    />
                    <GtkCheckButton label="Option 3" active={option3} onToggled={() => setOption3((v) => !v)} />
                </GtkBox>
                <GtkLabel
                    label={`Selected: ${[option1 && "1", option2 && "2", option3 && "3"].filter(Boolean).join(", ") || "None"}`}
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Disabled State" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkCheckButton label="Disabled unchecked" active={false} sensitive={false} />
                    <GtkCheckButton label="Disabled checked" active={true} sensitive={false} />
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const checkButtonDemo: Demo = {
    id: "check-button",
    title: "Check GtkButton",
    description: "Checkbox widgets for toggling boolean options.",
    keywords: ["check", "checkbox", "toggle", "GtkCheckButton"],
    component: CheckButtonDemo,
    sourcePath: getSourcePath(import.meta.url, "check-button.tsx"),
};
