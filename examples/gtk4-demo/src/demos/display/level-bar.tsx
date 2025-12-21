import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkLevelBar } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const LevelBarDemo = () => {
    const [level, setLevel] = useState(0.5);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Level Bar" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About Level Bar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkLevelBar is a bar widget that can be used as a level indicator. It can work in continuous or discrete mode and has built-in color offsets for different levels."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Interactive Level Bar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLevelBar value={level} minValue={0} maxValue={1} hexpand />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.CENTER}>
                    <GtkButton label="-" onClicked={() => setLevel((l) => Math.max(0, l - 0.1))} widthRequest={48} />
                    <GtkLabel label={`${Math.round(level * 100)}%`} widthRequest={60} halign={Gtk.Align.CENTER} />
                    <GtkButton label="+" onClicked={() => setLevel((l) => Math.min(1, l + 0.1))} widthRequest={48} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Different Levels" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkLabel label="Low" widthRequest={60} halign={Gtk.Align.END} />
                        <GtkLevelBar value={0.25} minValue={0} maxValue={1} hexpand />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkLabel label="Medium" widthRequest={60} halign={Gtk.Align.END} />
                        <GtkLevelBar value={0.5} minValue={0} maxValue={1} hexpand />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkLabel label="High" widthRequest={60} halign={Gtk.Align.END} />
                        <GtkLevelBar value={0.75} minValue={0} maxValue={1} hexpand />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkLabel label="Full" widthRequest={60} halign={Gtk.Align.END} />
                        <GtkLevelBar value={1} minValue={0} maxValue={1} hexpand />
                    </GtkBox>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Discrete Mode" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Level bar can also display discrete steps instead of a continuous bar."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkLevelBar value={3} minValue={0} maxValue={5} mode={Gtk.LevelBarMode.DISCRETE} hexpand />
            </GtkBox>
        </GtkBox>
    );
};

export const levelBarDemo: Demo = {
    id: "levelbar",
    title: "Level Bar",
    description: "Level indicator bar with color offsets.",
    keywords: ["level", "bar", "indicator", "meter", "GtkLevelBar"],
    component: LevelBarDemo,
    sourcePath: getSourcePath(import.meta.url, "level-bar.tsx"),
};
