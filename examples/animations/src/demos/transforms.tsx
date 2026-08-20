import { animated, to, useSpring } from "@gtkx/animated";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkFixed, GtkFixedLayoutChild, GtkLabel } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "./types.js";

type CornerName = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
type Corner = { x: number; y: number; angle: number };

const AnimatedFixedLayoutChild = animated(GtkFixedLayoutChild);

const CORNERS: Record<CornerName, Corner> = {
    topLeft: { x: 0, y: 0, angle: 0 },
    topRight: { x: 220, y: 0, angle: 8 },
    bottomLeft: { x: 0, y: 110, angle: -8 },
    bottomRight: { x: 220, y: 110, angle: 0 },
};

const CORNER_OPTIONS: { target: CornerName; label: string }[] = [
    { target: "topLeft", label: "Top left" },
    { target: "topRight", label: "Top right" },
    { target: "bottomLeft", label: "Bottom left" },
    { target: "bottomRight", label: "Bottom right" },
];

const transformsDemo: Demo = {
    id: "transforms",
    title: "Transforms",
    description:
        "Springs can drive Gsk transforms: useSpring animates x, y, and angle, and to() combines them into a " +
        "Gsk.Transform written to an animated(GtkFixedLayoutChild), sliding and tilting the label between corners.",
    component: TransformsDemo,
};

const place = (x: number, y: number, angle: number): Gsk.Transform | null =>
    Gsk.Transform.new().translate(new Graphene.Point({ x, y }))?.rotate(angle) ?? null;

function TransformsDemo() {
    const [corner, setCorner] = useState<CornerName>("topLeft");
    const { x, y, angle } = useSpring({ from: CORNERS.topLeft, to: CORNERS[corner] });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkBox spacing={6}>
                {CORNER_OPTIONS.map(({ target, label }) => (
                    <GtkButton
                        key={target}
                        label={label}
                        onClicked={() => {
                            setCorner(target);
                        }}
                    />
                ))}
            </GtkBox>
            <GtkFixed name="transforms-area" heightRequest={160} hexpand cssClasses={["frame"]}>
                <AnimatedFixedLayoutChild transform={to([x, y, angle], place)}>
                    <GtkLabel cssClasses={["title-2"]}>GTKX</GtkLabel>
                </AnimatedFixedLayoutChild>
            </GtkFixed>
        </GtkBox>
    );
}

export { transformsDemo };
