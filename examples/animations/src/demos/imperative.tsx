import { animated, useSpringValue } from "@gtkx/animated";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkLevelBar } from "@gtkx/jsx/gtk";
import type { Demo } from "./types.js";

const AnimatedLabel = animated(GtkLabel);
const AnimatedLevelBar = animated(GtkLevelBar);

const imperativeDemo: Demo = {
    id: "imperative",
    title: "Imperative API",
    description:
        "A single useSpringValue drives the level bar and the interpolated percent label, while the buttons " +
        "steer it imperatively through the SpringValue methods start, pause, resume, and set.",
    component: ImperativeDemo,
};

function ImperativeDemo() {
    const progress = useSpringValue(0, { config: { duration: 1500 } });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkBox spacing={6}>
                <GtkButton
                    name="imperative-start"
                    label="Start"
                    onClicked={() => {
                        void progress.start(100);
                    }}
                />
                <GtkButton
                    name="imperative-pause"
                    label="Pause"
                    onClicked={() => {
                        progress.pause();
                    }}
                />
                <GtkButton
                    name="imperative-resume"
                    label="Resume"
                    onClicked={() => {
                        progress.resume();
                    }}
                />
                <GtkButton
                    name="imperative-reset"
                    label="Reset"
                    onClicked={() => {
                        progress.set(0);
                    }}
                />
            </GtkBox>
            <AnimatedLevelBar name="imperative-level" minValue={0} maxValue={100} value={progress} hexpand />
            <AnimatedLabel
                name="imperative-percent"
                cssClasses={["title-3"]}
                halign={Gtk.Align.START}
                label={progress.to((current) => `${String(Math.round(current))}%`)}
            />
        </GtkBox>
    );
}

export { imperativeDemo };
