import { Overlay } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkGrid, GtkGridLayoutChild, GtkLabel } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./overlay.tsx?raw";

const OverlayDemo = () => {
    const [value, setValue] = useState("");

    const handleNumber = (num: number) => {
        setValue(String(num));
    };

    const handleEntryChanged = (entry: Gtk.Entry) => {
        setValue(entry.getText());
    };

    const buttons = [];
    for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 5; i++) {
            const num = 5 * j + i;
            buttons.push(
                <GtkGridLayoutChild key={num} column={i} row={j}>
                    <GtkButton label={String(num)} hexpand vexpand onClicked={() => handleNumber(num)} />
                </GtkGridLayoutChild>,
            );
        }
    }

    return (
        <Overlay>
            <GtkGrid name="number-grid">{buttons}</GtkGrid>
            <Overlay.Child>
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
            </Overlay.Child>
            <Overlay.Child>
                <GtkEntry
                    text={value}
                    placeholderText="Your Lucky Number"
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.CENTER}
                    marginTop={8}
                    marginBottom={8}
                    onChanged={handleEntryChanged}
                />
            </Overlay.Child>
        </Overlay>
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
