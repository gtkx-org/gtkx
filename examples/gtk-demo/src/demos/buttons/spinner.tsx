import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkSpinner } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./spinner.tsx?raw";

/**
 * Spinner demo matching the official GTK gtk-demo.
 * Shows spinners alongside entries in sensitive and insensitive states.
 */
const SpinnerDemo = () => {
    const [spinning, setSpinning] = useState(true);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={10}
            marginTop={5}
            marginBottom={5}
            marginStart={5}
            marginEnd={5}
        >
            <GtkBox spacing={5}>
                <GtkSpinner spinning={spinning} />
                <GtkEntry />
            </GtkBox>

            <GtkBox spacing={5} sensitive={false}>
                <GtkSpinner spinning={spinning} />
                <GtkEntry />
            </GtkBox>

            <GtkButton label="Play" onClicked={() => setSpinning(true)} />
            <GtkButton label="Stop" onClicked={() => setSpinning(false)} />
        </GtkBox>
    );
};

export const spinnerDemo: Demo = {
    id: "spinner",
    title: "Spinner",
    description: "GtkSpinner allows to show that background activity is on-going.",
    keywords: ["spinner", "GtkSpinner"],
    component: SpinnerDemo,
    sourceCode,
};
