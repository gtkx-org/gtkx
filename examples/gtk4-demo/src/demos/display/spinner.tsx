import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label, Spinner } from "@gtkx/gtkx";
import { useState } from "react";
import type { Demo } from "../types.js";

export const SpinnerDemo = () => {
    const [spinning, setSpinning] = useState(true);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Spinner" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About Spinners" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GtkSpinner displays an indefinite loading animation. It's useful for indicating that an operation is in progress."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Interactive Spinner" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    cssClasses={["card"]}
                    halign={Gtk.Align.CENTER}
                >
                    <Box
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginTop={20}
                        marginBottom={20}
                        marginStart={40}
                        marginEnd={40}
                    >
                        <Spinner spinning={spinning} widthRequest={48} heightRequest={48} halign={Gtk.Align.CENTER} />
                        <Button
                            label={spinning ? "Stop" : "Start"}
                            onClicked={() => setSpinning(!spinning)}
                            cssClasses={spinning ? ["destructive-action"] : ["suggested-action"]}
                        />
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Different Sizes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={24} halign={Gtk.Align.CENTER}>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Spinner spinning widthRequest={16} heightRequest={16} />
                        <Label.Root label="16px" cssClasses={["dim-label", "caption"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Spinner spinning widthRequest={32} heightRequest={32} />
                        <Label.Root label="32px" cssClasses={["dim-label", "caption"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Spinner spinning widthRequest={48} heightRequest={48} />
                        <Label.Root label="48px" cssClasses={["dim-label", "caption"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Spinner spinning widthRequest={64} heightRequest={64} />
                        <Label.Root label="64px" cssClasses={["dim-label", "caption"]} />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export const spinnerDemo: Demo = {
    id: "spinner",
    title: "Spinner",
    description: "Indefinite loading indicator animation.",
    keywords: ["spinner", "loading", "progress", "animation", "GtkSpinner"],
    component: SpinnerDemo,
    source: `const SpinnerDemo = () => {
    const [spinning, setSpinning] = useState(true);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <Spinner spinning={spinning} />
            <Button
                label={spinning ? "Stop" : "Start"}
                onClicked={() => setSpinning(!spinning)}
            />
        </Box>
    );
};`,
};
