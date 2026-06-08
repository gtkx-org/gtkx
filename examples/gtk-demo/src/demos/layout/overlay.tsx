import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkGrid, GtkGridChild, GtkLabel, GtkOverlay, GtkOverlayChild } from "@gtkx/react";
import { useCallback, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./overlay.tsx?raw";

/**
 * Overlay/Interactive Overlay demo matching the official GTK gtk-demo.
 * Shows widgets in static positions over a main widget.
 * The overlaid widgets can be interactive controls such as the entry in this
 * example, or just decorative, like the big blue label.
 */
const OverlayDemo = () => {
    const [value, setValue] = useState("");

    const handleNumber = useCallback((num: number) => {
        setValue(String(num));
    }, []);

    const handleEntryChanged = useCallback((entry: Gtk.Entry) => {
        setValue(entry.getText());
    }, []);

    const buttons = [];
    for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 5; i++) {
            const num = 5 * j + i;
            buttons.push(
                <GtkGridChild key={num} column={i} row={j}>
                    <GtkButton label={String(num)} hexpand vexpand onClicked={() => handleNumber(num)} />
                </GtkGridChild>,
            );
        }
    }

    return (
        <GtkOverlay>
            <GtkGrid>{buttons}</GtkGrid>
            <GtkOverlayChild>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.START}
                    canTarget={false}
                    spacing={10}
                >
                    <GtkLabel
                        name="numbers-label"
                        label="<span foreground='blue' weight='ultrabold' font='40'>Numbers</span>"
                        useMarkup
                        canTarget={false}
                        marginTop={8}
                        marginBottom={8}
                    />
                </GtkBox>
            </GtkOverlayChild>
            <GtkOverlayChild>
                <GtkEntry
                    text={value}
                    placeholderText="Your Lucky Number"
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.CENTER}
                    marginTop={8}
                    marginBottom={8}
                    onChanged={handleEntryChanged}
                />
            </GtkOverlayChild>
        </GtkOverlay>
    );
};

export const overlayDemo: Demo = {
    id: "overlay",
    title: "Overlay/Interactive Overlay",
    description:
        "Shows widgets in static positions over a main widget.\n\nThe overlaid widgets can be interactive controls such as the entry in this example, or just decorative, like the big blue label.",
    keywords: ["GtkOverlay"],
    component: OverlayDemo,
    sourceCode,
    defaultWidth: 500,
    defaultHeight: 510,
};
