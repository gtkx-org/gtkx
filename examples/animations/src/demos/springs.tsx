import { animated, config, useSpring } from "@gtkx/animated";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "./types.js";

type PresetName = (typeof presets)[number]["name"];

const presets = [
    { name: "default", label: "Default" },
    { name: "gentle", label: "Gentle" },
    { name: "wobbly", label: "Wobbly" },
    { name: "stiff", label: "Stiff" },
    { name: "slow", label: "Slow" },
    { name: "molasses", label: "Molasses" },
] as const;

const AnimatedLabel = animated.GtkLabel;

const springsDemo: Demo = {
    id: "springs",
    title: "Springs",
    description:
        "One useSpring fades and slides the card, an animated.GtkLabel built through the property form of the " +
        "animated wrapper, between two targets. The preset row switches the spring's config among the exported " +
        "presets (default, gentle, wobbly, stiff, slow, molasses) — pick a preset, then toggle the card to see " +
        "its character.",
    component: SpringsDemo,
};

function SpringsDemo() {
    const [isShown, setIsShown] = useState(true);
    const [preset, setPreset] = useState<PresetName>("default");

    const styles = useSpring({
        opacity: isShown ? 1 : 0.25,
        marginStart: isShown ? 0 : 160,
        config: config[preset],
    });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkBox spacing={6}>
                {presets.map(({ name, label }) => (
                    <GtkButton
                        key={name}
                        name={`preset-${name}`}
                        label={label}
                        cssClasses={preset === name ? ["suggested-action"] : []}
                        onClicked={() => {
                            setPreset(name);
                        }}
                    />
                ))}
            </GtkBox>
            <GtkToggleButton
                name="springs-toggle"
                label={isShown ? "Slide away" : "Bring back"}
                active={!isShown}
                halign={Gtk.Align.START}
                onToggled={(button) => {
                    setIsShown(!button.getActive());
                }}
            />
            <GtkFrame>
                <AnimatedLabel
                    name="springs-label"
                    label="Spring physics"
                    cssClasses={["title-3"]}
                    halign={Gtk.Align.START}
                    marginTop={24}
                    marginBottom={24}
                    marginEnd={24}
                    opacity={styles.opacity}
                    marginStart={styles.marginStart}
                />
            </GtkFrame>
        </GtkBox>
    );
}

export { springsDemo };
