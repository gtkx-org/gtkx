import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label, LinkButton, ToggleButton } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";

export const ButtonsDemo = () => {
    const [clickCount, setClickCount] = useState(0);
    const [toggled, setToggled] = useState(false);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Button Types" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Regular Buttons" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Button label="Normal" onClicked={() => setClickCount((c) => c + 1)} />
                    <Button
                        label="Suggested"
                        cssClasses={["suggested-action"]}
                        onClicked={() => setClickCount((c) => c + 1)}
                    />
                    <Button
                        label="Destructive"
                        cssClasses={["destructive-action"]}
                        onClicked={() => setClickCount((c) => c + 1)}
                    />
                    <Button label="Flat" cssClasses={["flat"]} onClicked={() => setClickCount((c) => c + 1)} />
                </Box>
                <Label.Root label={`Clicked ${clickCount} times`} cssClasses={["dim-label"]} />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Toggle Button" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <ToggleButton.Root
                        label={toggled ? "ON" : "OFF"}
                        active={toggled}
                        onToggled={() => setToggled((t) => !t)}
                    />
                    <Label.Root label={`Toggle state: ${toggled ? "Active" : "Inactive"}`} />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Link Button" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <LinkButton uri="https://gtk.org" label="Visit GTK Website" />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Button Sizes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12} valign={Gtk.Align.CENTER}>
                    <Button label="Small" cssClasses={["small"]} />
                    <Button label="Normal" />
                    <Button label="Large" cssClasses={["large"]} />
                </Box>
            </Box>
        </Box>
    );
};

export const buttonsDemo: Demo = {
    id: "buttons",
    title: "Buttons",
    description: "Various button types and styles available in GTK4.",
    keywords: ["button", "toggle", "link", "GtkButton", "GtkToggleButton", "GtkLinkButton"],
    component: ButtonsDemo,
    source: `import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label, LinkButton, ToggleButton } from "@gtkx/react";
import { useState } from "react";

export const ButtonsDemo = () => {
    const [clickCount, setClickCount] = useState(0);
    const [toggled, setToggled] = useState(false);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Button Types" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Regular Buttons" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box spacing={12}>
                    <Button label="Normal" onClicked={() => setClickCount((c) => c + 1)} />
                    <Button label="Suggested" cssClasses={["suggested-action"]} onClicked={() => setClickCount((c) => c + 1)} />
                    <Button label="Destructive" cssClasses={["destructive-action"]} onClicked={() => setClickCount((c) => c + 1)} />
                    <Button label="Flat" cssClasses={["flat"]} onClicked={() => setClickCount((c) => c + 1)} />
                </Box>
                <Label.Root label={\`Clicked \${clickCount} times\`} cssClasses={["dim-label"]} />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Toggle Button" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box spacing={12}>
                    <ToggleButton.Root
                        label={toggled ? "ON" : "OFF"}
                        active={toggled}
                        onToggled={() => setToggled((t) => !t)}
                    />
                    <Label.Root label={\`Toggle state: \${toggled ? "Active" : "Inactive"}\`} />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Link Button" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <LinkButton uri="https://gtk.org" label="Visit GTK Website" />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Button Sizes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box spacing={12} valign={Gtk.Align.CENTER}>
                    <Button label="Small" cssClasses={["small"]} />
                    <Button label="Normal" />
                    <Button label="Large" cssClasses={["large"]} />
                </Box>
            </Box>
        </Box>
    );
};`,
};
