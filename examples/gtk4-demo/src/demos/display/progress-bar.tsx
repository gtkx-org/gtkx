import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label, ProgressBar } from "@gtkx/react";
import { useEffect, useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const ProgressBarDemo = () => {
    const [progress, setProgress] = useState(0);
    const [running, setRunning] = useState(false);

    useEffect(() => {
        if (!running) return;

        const timer = setInterval(() => {
            setProgress((p) => {
                if (p >= 1) {
                    setRunning(false);
                    return 0;
                }
                return p + 0.02;
            });
        }, 50);

        return () => clearInterval(timer);
    }, [running]);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Progress Bar" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Determinate Progress" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="Shows progress with a specific value between 0 and 1."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <ProgressBar fraction={progress} showText text={`${Math.round(progress * 100)}%`} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.CENTER}>
                    <Button
                        label={running ? "Running..." : "Start"}
                        onClicked={() => setRunning(true)}
                        sensitive={!running}
                        cssClasses={["suggested-action"]}
                    />
                    <Button
                        label="Reset"
                        onClicked={() => {
                            setRunning(false);
                            setProgress(0);
                        }}
                    />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Progress Levels" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <Label.Root label="0%" widthRequest={40} halign={Gtk.Align.END} />
                        <ProgressBar fraction={0} hexpand />
                    </Box>
                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <Label.Root label="25%" widthRequest={40} halign={Gtk.Align.END} />
                        <ProgressBar fraction={0.25} hexpand />
                    </Box>
                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <Label.Root label="50%" widthRequest={40} halign={Gtk.Align.END} />
                        <ProgressBar fraction={0.5} hexpand />
                    </Box>
                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <Label.Root label="75%" widthRequest={40} halign={Gtk.Align.END} />
                        <ProgressBar fraction={0.75} hexpand />
                    </Box>
                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <Label.Root label="100%" widthRequest={40} halign={Gtk.Align.END} />
                        <ProgressBar fraction={1} hexpand />
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="With Text" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <ProgressBar fraction={0.65} showText text="Downloading..." />
            </Box>
        </Box>
    );
};

export const progressBarDemo: Demo = {
    id: "progressbar",
    title: "Progress Bar",
    description: "Visual indicator for operation progress.",
    keywords: ["progress", "bar", "loading", "percentage", "GtkProgressBar"],
    component: ProgressBarDemo,
    sourcePath: getSourcePath(import.meta.url, "progressbar.tsx"),
};
