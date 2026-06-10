import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkGestureDrag } from "@gtkx/jsx/gtk";
import { GtkConstraintLayout } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import { ConstraintChildButtons } from "./child-buttons.js";
import sourceCode from "./constraints-interactive.tsx?raw";

const A = Gtk.ConstraintAttribute;

const ConstraintsInteractive = () => {
    const [dividerOffset, setDividerOffset] = useState(0);

    return (
        <GtkBox name="container" hexpand vexpand>
            <GtkConstraintLayout>
                <GtkConstraintLayout.Guide id="divider" />
                <GtkConstraintLayout.Constraint
                    target="divider"
                    targetAttribute={A.WIDTH}
                    sourceAttribute={A.NONE}
                    constant={0}
                />
                <GtkConstraintLayout.Constraint
                    target="divider"
                    targetAttribute={A.LEFT}
                    sourceAttribute={A.LEFT}
                    constant={dividerOffset}
                />
                <GtkConstraintLayout.Constraint
                    target="button1"
                    targetAttribute={A.START}
                    sourceAttribute={A.START}
                    constant={8}
                />
                <GtkConstraintLayout.Constraint
                    target="button1"
                    targetAttribute={A.END}
                    source="divider"
                    sourceAttribute={A.START}
                />
                <GtkConstraintLayout.Constraint
                    target="button2"
                    targetAttribute={A.START}
                    source="divider"
                    sourceAttribute={A.END}
                />
                <GtkConstraintLayout.Constraint
                    target="button2"
                    targetAttribute={A.END}
                    sourceAttribute={A.END}
                    constant={-8}
                />
                <GtkConstraintLayout.Constraint
                    target="button3"
                    targetAttribute={A.START}
                    sourceAttribute={A.START}
                    constant={8}
                />
                <GtkConstraintLayout.Constraint
                    target="button3"
                    targetAttribute={A.END}
                    source="divider"
                    sourceAttribute={A.START}
                />
                <GtkConstraintLayout.Constraint
                    target="button1"
                    targetAttribute={A.TOP}
                    sourceAttribute={A.TOP}
                    constant={8}
                />
                <GtkConstraintLayout.Constraint
                    target="button2"
                    targetAttribute={A.TOP}
                    source="button1"
                    sourceAttribute={A.BOTTOM}
                />
                <GtkConstraintLayout.Constraint
                    target="button3"
                    targetAttribute={A.TOP}
                    source="button2"
                    sourceAttribute={A.BOTTOM}
                />
                <GtkConstraintLayout.Constraint
                    target="button3"
                    targetAttribute={A.BOTTOM}
                    sourceAttribute={A.BOTTOM}
                    constant={-8}
                />
            </GtkConstraintLayout>
            <GtkGestureDrag
                onDragUpdate={(offsetX, _offsetY, self) => {
                    const [success, startX] = self.getStartPoint();
                    if (success) setDividerOffset(startX + offsetX);
                }}
            />
            <ConstraintChildButtons />
        </GtkBox>
    );
};

export const constraintsInteractiveDemo: Demo = {
    id: "constraints-interactive",
    title: "Constraints/Interactive Constraints",
    description:
        "This example shows how constraints can be updated during user interaction. The vertical edge between the buttons can be dragged with the mouse.",
    keywords: ["GtkConstraintLayout"],
    component: ConstraintsInteractive,
    sourceCode,
    defaultWidth: 260,
};
