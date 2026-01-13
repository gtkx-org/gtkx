import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFlowBox, GtkFrame, GtkLabel, GtkScale, GtkScrolledWindow } from "@gtkx/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./fishbowl.tsx?raw";

const fishColors = [
    "#e01b24",
    "#ff7800",
    "#f5c211",
    "#33d17a",
    "#3584e4",
    "#9141ac",
    "#c64600",
    "#f66151",
    "#ffbe6f",
    "#8ff0a4",
    "#99c1f1",
    "#dc8add",
];

interface Fish {
    id: number;
    color: string;
    rotation: number;
}

const FishbowlDemo = () => {
    const [fishCount, setFishCount] = useState(50);
    const [isAnimating, setIsAnimating] = useState(false);
    const [fps, setFps] = useState(0);
    const [fishes, setFishes] = useState<Fish[]>([]);
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(Date.now());

    useEffect(() => {
        const newFishes: Fish[] = [];
        for (let i = 0; i < fishCount; i++) {
            const color = fishColors[i % fishColors.length] ?? "#e01b24";
            newFishes.push({
                id: i,
                color,
                rotation: Math.random() * 360,
            });
        }
        setFishes(newFishes);
    }, [fishCount]);

    useEffect(() => {
        if (!isAnimating) return;

        const interval = setInterval(() => {
            setFishes((prevFishes) =>
                prevFishes.map((fish) => ({
                    ...fish,
                    rotation: (fish.rotation + 5 + Math.random() * 10) % 360,
                })),
            );

            frameCountRef.current++;
            const now = Date.now();
            const elapsed = now - lastTimeRef.current;
            if (elapsed >= 1000) {
                setFps(Math.round((frameCountRef.current * 1000) / elapsed));
                frameCountRef.current = 0;
                lastTimeRef.current = now;
            }
        }, 16); // ~60fps target

        return () => clearInterval(interval);
    }, [isAnimating]);

    const fishCountAdjustment = useMemo(() => new Gtk.Adjustment(50, 10, 500, 10, 50, 0), []);

    const handleFishCountChange = (scale: Gtk.Range) => {
        setFishCount(Math.round(scale.getValue()));
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Fishbowl" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="A performance stress test that renders many animated widgets. This demo helps test the rendering performance of the GTK/React reconciler. Increase the fish count to stress the system."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Controls">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Fish Count:" halign={Gtk.Align.START} />
                        <GtkScale
                            hexpand
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            digits={0}
                            adjustment={fishCountAdjustment}
                            onValueChanged={handleFishCountChange}
                        />
                    </GtkBox>

                    <GtkBox spacing={12}>
                        <GtkButton
                            label={isAnimating ? "Stop Animation" : "Start Animation"}
                            onClicked={() => setIsAnimating(!isAnimating)}
                            cssClasses={[isAnimating ? "destructive-action" : "suggested-action"]}
                        />
                        <GtkLabel label={`FPS: ${fps}`} cssClasses={["monospace"]} valign={Gtk.Align.CENTER} />
                        <GtkLabel
                            label={`Widgets: ${fishCount}`}
                            cssClasses={["dim-label"]}
                            valign={Gtk.Align.CENTER}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Fishbowl">
                <GtkScrolledWindow heightRequest={300} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <GtkFlowBox
                        selectionMode={Gtk.SelectionMode.NONE}
                        maxChildrenPerLine={20}
                        minChildrenPerLine={5}
                        columnSpacing={4}
                        rowSpacing={4}
                        homogeneous
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        {fishes.map((fish) => (
                            <GtkLabel key={fish.id} label="🐟" widthRequest={24} heightRequest={24} />
                        ))}
                    </GtkFlowBox>
                </GtkScrolledWindow>
            </GtkFrame>

            <GtkFrame label="Performance Notes">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="This demo tests the performance of React reconciliation with GTK widgets. Unlike web browsers, GTK widgets have more overhead per element."
                        wrap
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="Tips for better performance:"
                        cssClasses={["heading"]}
                        halign={Gtk.Align.START}
                        marginTop={8}
                    />
                    <GtkLabel
                        label={`- Use virtualized lists for large data sets
- Minimize state updates to only what's necessary
- Batch updates when possible
- Consider using CSS animations instead of React state`}
                        wrap
                        halign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const fishbowlDemo: Demo = {
    id: "fishbowl",
    title: "Fishbowl",
    description: "Performance stress test with many animated widgets",
    keywords: ["performance", "stress test", "animation", "benchmark", "fps", "widgets"],
    component: FishbowlDemo,
    sourceCode,
};
