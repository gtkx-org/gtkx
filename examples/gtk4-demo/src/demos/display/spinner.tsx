import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkSpinner } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const SpinnerDemo = () => {
    const [spinning, setSpinning] = useState(true);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Spinner" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About Spinners" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkSpinner displays an indefinite loading animation. It's useful for indicating that an operation is in progress."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Interactive Spinner" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    cssClasses={["card"]}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginTop={20}
                        marginBottom={20}
                        marginStart={40}
                        marginEnd={40}
                    >
                        <GtkSpinner
                            spinning={spinning}
                            widthRequest={48}
                            heightRequest={48}
                            halign={Gtk.Align.CENTER}
                        />
                        <GtkButton
                            label={spinning ? "Stop" : "Start"}
                            onClicked={() => setSpinning(!spinning)}
                            cssClasses={spinning ? ["destructive-action"] : ["suggested-action"]}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Different Sizes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={24} halign={Gtk.Align.CENTER}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkSpinner spinning widthRequest={16} heightRequest={16} />
                        <GtkLabel label="16px" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkSpinner spinning widthRequest={32} heightRequest={32} />
                        <GtkLabel label="32px" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkSpinner spinning widthRequest={48} heightRequest={48} />
                        <GtkLabel label="48px" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkSpinner spinning widthRequest={64} heightRequest={64} />
                        <GtkLabel label="64px" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const spinnerDemo: Demo = {
    id: "spinner",
    title: "Spinner",
    description: "Indefinite loading indicator animation.",
    keywords: ["spinner", "loading", "progress", "animation", "GtkSpinner"],
    component: SpinnerDemo,
    sourcePath: getSourcePath(import.meta.url, "spinner.tsx"),
};
