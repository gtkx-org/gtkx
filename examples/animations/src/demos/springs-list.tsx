import { animated, useSprings } from "@gtkx/animated";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkLevelBar } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "./types.js";

const AnimatedLevelBar = animated(GtkLevelBar);

const presets = [
    [0.2, 0.5, 0.8, 0.35],
    [0.9, 0.15, 0.6, 0.75],
    [0.45, 0.7, 0.3, 0.95],
] as const;

const barCount = 4;

const springsListDemo: Demo = {
    id: "springs-list",
    title: "Springs List",
    description:
        "Drives a column of level bars from a single useSprings call, one spring per bar. " +
        "The Next preset button starts every spring at once toward the next set of targets through the springs api.",
    component: SpringsListDemo,
};

const targetFor = (presetIndex: number, barIndex: number): number =>
    presets[presetIndex % presets.length]?.[barIndex] ?? 0;

function SpringsListDemo() {
    const [presetIndex, setPresetIndex] = useState(0);

    const [springs, api] = useSprings(barCount, (index) => ({
        from: { value: 0 },
        to: { value: targetFor(0, index) },
    }));

    const nextPreset = (): void => {
        const next = (presetIndex + 1) % presets.length;
        setPresetIndex(next);
        void Promise.all(api.start((index) => ({ value: targetFor(next, index) })));
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkLabel halign={Gtk.Align.START} cssClasses={["dim-label"]}>
                {`Preset ${String(presetIndex + 1)} of ${String(presets.length)}`}
            </GtkLabel>
            {springs.map((styles, index) => (
                <AnimatedLevelBar
                    key={String(index)}
                    name={`springs-list-bar-${String(index)}`}
                    value={styles.value}
                    widthRequest={320}
                    halign={Gtk.Align.START}
                />
            ))}
            <GtkButton label="Next preset" halign={Gtk.Align.START} onClicked={nextPreset} />
        </GtkBox>
    );
}

export { springsListDemo };
