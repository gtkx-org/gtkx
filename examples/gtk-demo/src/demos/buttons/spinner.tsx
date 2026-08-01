import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkSpinner } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./spinner.tsx?raw";

const spinnerDemo: Demo = {
    id: "spinner",
    title: "Spinner",
    description: "GtkSpinner allows to show that background activity is on-going.",
    keywords: ["gtkspinner"],
    component: SpinnerDemo,
    sourceCode,
    isResizable: false,
};

function SpinnerDemo() {
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
            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={5}>
                <GtkSpinner spinning={spinning} />
                <GtkEntry />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={5} sensitive={false}>
                <GtkSpinner spinning={spinning} />
                <GtkEntry />
            </GtkBox>

            <GtkButton
                label="Play"
                onClicked={() => {
                    setSpinning(true);
                }}
            />
            <GtkButton
                label="Stop"
                onClicked={() => {
                    setSpinning(false);
                }}
            />
        </GtkBox>
    );
}

export { spinnerDemo };
