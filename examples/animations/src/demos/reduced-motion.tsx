import { animated, useReducedMotion, useSpring } from "@gtkx/animated";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "./types.js";

const SLIDE_DISTANCE = 200;

const reducedMotionDemo: Demo = {
    id: "reduced-motion",
    title: "Reduced Motion",
    description:
        "useReducedMotion reports the desktop's reduce-animations preference, and the slide's useSpring sets its " +
        "immediate option from it, so the label jumps straight to its target when the desktop asks for less motion.",
    component: ReducedMotionDemo,
};

const describeMotion = (isReduced: boolean | null): string => {
    if (isReduced === null) {
        return "Reduced motion: unknown";
    }

    return isReduced ? "Reduced motion: on" : "Reduced motion: off";
};

function ReducedMotionDemo() {
    const isReduced = useReducedMotion();
    const [isShifted, setIsShifted] = useState(false);

    const styles = useSpring({
        from: { marginStart: 0 },
        to: { marginStart: isShifted ? SLIDE_DISTANCE : 0 },
        immediate: isReduced === true,
    });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkLabel halign={Gtk.Align.START}>{describeMotion(isReduced)}</GtkLabel>
            <GtkButton
                label={isShifted ? "Slide back" : "Slide away"}
                halign={Gtk.Align.START}
                onClicked={() => {
                    setIsShifted((current) => !current);
                }}
            />
            <animated.GtkLabel
                name="reduced-motion-slider"
                halign={Gtk.Align.START}
                marginStart={styles.marginStart}
                cssClasses={["title-3"]}
            >
                Gentle by request
            </animated.GtkLabel>
        </GtkBox>
    );
}

export { reducedMotionDemo };
