import { animated, useTrail } from "@gtkx/animated";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "./types.js";

const AnimatedLabel = animated(GtkLabel);
const items = ["Alpha", "Beta", "Gamma", "Delta"];
const hiddenMargin = 48;

const trailDemo: Demo = {
    id: "trail",
    title: "Trail",
    description:
        "Staggers a column of labels with useTrail, each one trailing the spring before it. " +
        "The toggle button flips every label's opacity and start margin in and out through the same trail.",
    component: TrailDemo,
};

function TrailDemo() {
    const [isShown, setIsShown] = useState(true);

    const trail = useTrail(items.length, {
        opacity: isShown ? 1 : 0,
        marginStart: isShown ? 0 : hiddenMargin,
        from: { opacity: 0, marginStart: hiddenMargin },
    });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <GtkToggleButton
                name="trail-toggle"
                label="Toggle trail"
                active={isShown}
                halign={Gtk.Align.START}
                onToggled={(button) => {
                    setIsShown(button.getActive());
                }}
            />
            {trail.map((styles, index) => (
                <AnimatedLabel
                    key={items[index] ?? String(index)}
                    label={items[index] ?? ""}
                    opacity={styles.opacity}
                    marginStart={styles.marginStart}
                    halign={Gtk.Align.START}
                    cssClasses={["title-4"]}
                />
            ))}
        </GtkBox>
    );
}

export { trailDemo };
