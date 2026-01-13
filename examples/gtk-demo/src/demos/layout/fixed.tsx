import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFixed, GtkLabel, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./fixed.tsx?raw";

interface Position {
    x: number;
    y: number;
    label: string;
}

const FixedDemo = () => {
    const [positions, setPositions] = useState<Position[]>([
        { x: 20, y: 20, label: "Widget A" },
        { x: 150, y: 40, label: "Widget B" },
        { x: 80, y: 100, label: "Widget C" },
    ]);

    const randomizePositions = () => {
        setPositions(
            positions.map((pos) => ({
                ...pos,
                x: Math.floor(Math.random() * 200),
                y: Math.floor(Math.random() * 120),
            })),
        );
    };

    const addWidget = () => {
        const newLabel = `Widget ${String.fromCharCode(65 + positions.length)}`;
        setPositions([
            ...positions,
            {
                x: Math.floor(Math.random() * 200),
                y: Math.floor(Math.random() * 120),
                label: newLabel,
            },
        ]);
    };

    const removeWidget = () => {
        if (positions.length > 0) {
            setPositions(positions.slice(0, -1));
        }
    };

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Fixed Positioning" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="About GtkFixed" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkFixed places child widgets at absolute positions. Unlike other containers, it does not perform any automatic layout. Use FixedChild with x and y props to position children declaratively."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Absolute Positioning" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Click 'Randomize' to move widgets to random positions."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={8}>
                    <GtkButton
                        label="Randomize Positions"
                        onClicked={randomizePositions}
                        cssClasses={["suggested-action"]}
                    />
                    <GtkButton label="Add Widget" onClicked={addWidget} />
                    <GtkButton label="Remove Widget" onClicked={removeWidget} />
                </GtkBox>
                <GtkFixed widthRequest={350} heightRequest={180} cssClasses={["card"]} marginTop={8}>
                    {positions.map((pos) => (
                        <x.FixedChild key={pos.label} x={pos.x} y={pos.y}>
                            <GtkLabel label={pos.label} cssClasses={["accent", "pill"]} />
                        </x.FixedChild>
                    ))}
                </GtkFixed>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Current Positions" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={4}
                    cssClasses={["card"]}
                    marginStart={12}
                    marginEnd={12}
                    marginTop={8}
                    marginBottom={8}
                >
                    {positions.map((pos) => (
                        <GtkLabel
                            key={pos.label}
                            label={`${pos.label}: (${pos.x}, ${pos.y})`}
                            halign={Gtk.Align.START}
                            marginStart={12}
                            marginTop={4}
                            marginBottom={4}
                        />
                    ))}
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Caution" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkFixed should be used sparingly. Fixed positioning does not adapt to different themes, font sizes, translations, or screen sizes. For most layouts, prefer GtkBox, GtkGrid, or other layout containers."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const fixedDemo: Demo = {
    id: "fixed",
    title: "Fixed Layout / Cube",
    description: "GtkFixed is a container that allows placing and transforming widgets manually.",
    keywords: ["fixed", "absolute", "position", "coordinates", "GtkFixed", "FixedChild", "GtkLayoutManager"],
    component: FixedDemo,
    sourceCode,
};
