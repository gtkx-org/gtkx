import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkGrid, GtkLabel, GtkOverlay, x } from "@gtkx/react";
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
                <x.GridChild key={num} column={i} row={j}>
                    <GtkButton label={String(num)} hexpand vexpand onClicked={() => handleNumber(num)} />
                </x.GridChild>,
            );
        }
    }

    return (
        <GtkOverlay>
            <GtkGrid>{buttons}</GtkGrid>
            <x.OverlayChild>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.START}
                    canTarget={false}
                >
                    <GtkLabel
                        label="<span foreground='blue' weight='ultrabold' font='40'>Numbers</span>"
                        useMarkup
                        canTarget={false}
                        marginTop={8}
                        marginBottom={8}
                    />
                </GtkBox>
            </x.OverlayChild>
            <x.OverlayChild>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                    <GtkEntry
                        text={value}
                        placeholderText="Your Lucky Number"
                        marginTop={8}
                        marginBottom={8}
                        onChanged={handleEntryChanged}
                    />
                </GtkBox>
            </x.OverlayChild>
        </GtkOverlay>
    );
};

export const overlayDemo: Demo = {
    id: "overlay",
    title: "Overlay/Interactive Overlay",
    description:
        "Shows widgets in static positions over a main widget. The overlaid widgets can be interactive controls such as the entry in this example, or just decorative, like the big blue label.",
    keywords: ["overlay", "GtkOverlay", "layer", "stack"],
    component: OverlayDemo,
    sourceCode,
};
