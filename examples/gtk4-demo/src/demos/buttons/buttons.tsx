import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkLinkButton, GtkToggleButton } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const GtkButtonsDemo = () => {
    const [clickCount, setClickCount] = useState(0);
    const [toggled, setToggled] = useState(false);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="<GtkButton Types" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Regular GtkButtons" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkButton label="Normal" onClicked={() => setClickCount((c) => c + 1)} />
                    <GtkButton
                        label="Suggested"
                        cssClasses={["suggested-action"]}
                        onClicked={() => setClickCount((c) => c + 1)}
                    />
                    <GtkButton
                        label="Destructive"
                        cssClasses={["destructive-action"]}
                        onClicked={() => setClickCount((c) => c + 1)}
                    />
                    <GtkButton label="Flat" cssClasses={["flat"]} onClicked={() => setClickCount((c) => c + 1)} />
                </GtkBox>
                <GtkLabel label={`Clicked ${clickCount} times`} cssClasses={["dim-label"]} />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Toggle GtkButton" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkToggleButton.Root
                        label={toggled ? "ON" : "OFF"}
                        active={toggled}
                        onToggled={() => setToggled((t) => !t)}
                    />
                    <GtkLabel label={`Toggle state: ${toggled ? "Active" : "Inactive"}`} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Link GtkButton" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLinkButton uri="https://gtk.org" label="Visit GTK Website" />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="<GtkButton Sizes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12} valign={Gtk.Align.CENTER}>
                    <GtkButton label="Small" cssClasses={["small"]} />
                    <GtkButton label="Normal" />
                    <GtkButton label="Large" cssClasses={["large"]} />
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const buttonsDemo: Demo = {
    id: "buttons",
    title: "Buttons",
    description: "Various button types and styles available in GTK4.",
    keywords: ["button", "toggle", "link", "GtkButton", "GtkToggleButton", "GtkLinkButton"],
    component: GtkButtonsDemo,
    sourcePath: getSourcePath(import.meta.url, "buttons.tsx"),
};
