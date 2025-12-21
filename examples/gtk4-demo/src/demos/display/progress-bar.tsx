import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkProgressBar } from "@gtkx/react";
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
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Progress Bar" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Determinate Progress" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Shows progress with a specific value between 0 and 1."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkProgressBar fraction={progress} showText text={`${Math.round(progress * 100)}%`} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.CENTER}>
                    <GtkButton
                        label={running ? "Running..." : "Start"}
                        onClicked={() => setRunning(true)}
                        sensitive={!running}
                        cssClasses={["suggested-action"]}
                    />
                    <GtkButton
                        label="Reset"
                        onClicked={() => {
                            setRunning(false);
                            setProgress(0);
                        }}
                    />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Progress Levels" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkLabel label="0%" widthRequest={40} halign={Gtk.Align.END} />
                        <GtkProgressBar fraction={0} hexpand />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkLabel label="25%" widthRequest={40} halign={Gtk.Align.END} />
                        <GtkProgressBar fraction={0.25} hexpand />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkLabel label="50%" widthRequest={40} halign={Gtk.Align.END} />
                        <GtkProgressBar fraction={0.5} hexpand />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkLabel label="75%" widthRequest={40} halign={Gtk.Align.END} />
                        <GtkProgressBar fraction={0.75} hexpand />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkLabel label="100%" widthRequest={40} halign={Gtk.Align.END} />
                        <GtkProgressBar fraction={1} hexpand />
                    </GtkBox>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="With Text" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkProgressBar fraction={0.65} showText text="Downloading..." />
            </GtkBox>
        </GtkBox>
    );
};

export const progressBarDemo: Demo = {
    id: "progressbar",
    title: "Progress Bar",
    description: "Visual indicator for operation progress.",
    keywords: ["progress", "bar", "loading", "percentage", "GtkProgressBar"],
    component: ProgressBarDemo,
    sourcePath: getSourcePath(import.meta.url, "progress-bar.tsx"),
};
