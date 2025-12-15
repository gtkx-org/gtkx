import * as Gtk from "@gtkx/ffi/gtk";
import { Box, CheckButton, Label } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const CheckButtonDemo = () => {
    const [option1, setOption1] = useState(false);
    const [option2, setOption2] = useState(true);
    const [option3, setOption3] = useState(false);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Check Buttons" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Independent Checkboxes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <CheckButton.Root label="Option 1" active={option1} onToggled={() => setOption1((v) => !v)} />
                    <CheckButton.Root
                        label="Option 2 (initially checked)"
                        active={option2}
                        onToggled={() => setOption2((v) => !v)}
                    />
                    <CheckButton.Root label="Option 3" active={option3} onToggled={() => setOption3((v) => !v)} />
                </Box>
                <Label
                    label={`Selected: ${[option1 && "1", option2 && "2", option3 && "3"].filter(Boolean).join(", ") || "None"}`}
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Disabled State" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <CheckButton.Root label="Disabled unchecked" active={false} sensitive={false} />
                    <CheckButton.Root label="Disabled checked" active={true} sensitive={false} />
                </Box>
            </Box>
        </Box>
    );
};

export const checkButtonDemo: Demo = {
    id: "check-button",
    title: "Check Button",
    description: "Checkbox widgets for toggling boolean options.",
    keywords: ["check", "checkbox", "toggle", "GtkCheckButton"],
    component: CheckButtonDemo,
    sourcePath: getSourcePath(import.meta.url, "check-button.tsx"),
};
