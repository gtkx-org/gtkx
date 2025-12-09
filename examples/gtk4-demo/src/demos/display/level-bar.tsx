import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label, LevelBar } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const LevelBarDemo = () => {
    const [level, setLevel] = useState(0.5);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Level Bar" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About Level Bar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GtkLevelBar is a bar widget that can be used as a level indicator. It can work in continuous or discrete mode and has built-in color offsets for different levels."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Interactive Level Bar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <LevelBar value={level} minValue={0} maxValue={1} hexpand />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.CENTER}>
                    <Button label="-" onClicked={() => setLevel((l) => Math.max(0, l - 0.1))} widthRequest={48} />
                    <Label.Root label={`${Math.round(level * 100)}%`} widthRequest={60} halign={Gtk.Align.CENTER} />
                    <Button label="+" onClicked={() => setLevel((l) => Math.min(1, l + 0.1))} widthRequest={48} />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Different Levels" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <Label.Root label="Low" widthRequest={60} halign={Gtk.Align.END} />
                        <LevelBar value={0.25} minValue={0} maxValue={1} hexpand />
                    </Box>
                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <Label.Root label="Medium" widthRequest={60} halign={Gtk.Align.END} />
                        <LevelBar value={0.5} minValue={0} maxValue={1} hexpand />
                    </Box>
                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <Label.Root label="High" widthRequest={60} halign={Gtk.Align.END} />
                        <LevelBar value={0.75} minValue={0} maxValue={1} hexpand />
                    </Box>
                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <Label.Root label="Full" widthRequest={60} halign={Gtk.Align.END} />
                        <LevelBar value={1} minValue={0} maxValue={1} hexpand />
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Discrete Mode" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="Level bar can also display discrete steps instead of a continuous bar."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <LevelBar value={3} minValue={0} maxValue={5} mode={Gtk.LevelBarMode.DISCRETE} hexpand />
            </Box>
        </Box>
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
