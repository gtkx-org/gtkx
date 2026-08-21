import { animated, config, useSpring } from "@gtkx/animated";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "./types.js";

type CardStyle = {
    background: string;
    borderRadius: string;
    boxShadow: string;
    padding: string;
};

const AnimatedBox = animated(GtkBox);
const AnimatedLabel = animated(GtkLabel);
const CARD = { duration: 600 };
const CALM_TEXT = "rgb(46, 52, 54)";
const ALERT_TEXT = "rgb(255, 255, 255)";
const BASE_RADIUS = 6;
const EXTRA_RADIUS = 18;

const styleDemo: Demo = {
    id: "style",
    title: "Style",
    description:
        "Animates what GTK4 exposes through CSS alone: background, border radius and box shadow on the card, and " +
        "text color on the labels. The card takes one spring interpolated into the whole style object, while the " +
        "labels take a spring on a single declaration, the way React Spring is written for the DOM.",
    component: StyleDemo,
};

const cardStyle = (level: number): CardStyle => ({
    background: `mix(var(--card-bg-color), var(--error-bg-color), ${level.toFixed(3)})`,
    borderRadius: `${(BASE_RADIUS + level * EXTRA_RADIUS).toFixed(1)}px`,
    boxShadow:
        `0 ${(2 + level * 8).toFixed(1)}px ${(6 + level * 14).toFixed(1)}px ` +
        `alpha(var(--shade-color), ${(0.3 + level * 0.4).toFixed(2)})`,
    padding: "18px",
});

function StyleDemo() {
    const [isAlert, setIsAlert] = useState(false);
    const { level } = useSpring({ level: isAlert ? 1 : 0, config: CARD });
    const { tint } = useSpring({ tint: isAlert ? ALERT_TEXT : CALM_TEXT, config: config.molasses });

    const toggle = (button: Gtk.ToggleButton): void => {
        setIsAlert(button.getActive());
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <AnimatedBox
                name="style-card"
                style={level.to(cardStyle)}
                orientation={Gtk.Orientation.VERTICAL}
                spacing={6}
            >
                <AnimatedLabel
                    name="style-heading"
                    style={{ color: tint, fontWeight: 700 }}
                    halign={Gtk.Align.START}
                    label="Deploy finished"
                />
                <AnimatedLabel
                    name="style-body"
                    style={{ color: tint }}
                    halign={Gtk.Align.START}
                    label="Two of nine checks reported a warning."
                />
            </AnimatedBox>
            <GtkToggleButton
                name="style-toggle"
                label="Raise alert"
                halign={Gtk.Align.START}
                active={isAlert}
                onToggled={toggle}
            />
        </GtkBox>
    );
}

export { styleDemo };
