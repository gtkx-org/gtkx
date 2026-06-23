import { ConstraintLayout } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkGestureDrag } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import { BottomEdgeConstraint, ConstraintContainer, TopEdgeConstraint } from "./constraint-helpers.js";
import sourceCode from "./constraints-interactive.tsx?raw";

const A = Gtk.ConstraintAttribute;

const renderDividerConstraints = (dividerOffset: number | null) => (
    <>
        <ConstraintLayout.Guide id="divider" />
        <ConstraintLayout.Constraint target="divider" targetAttribute={A.WIDTH} sourceAttribute={A.NONE} constant={0} />
        {dividerOffset === null ? null : (
            <ConstraintLayout.Constraint
                target="divider"
                targetAttribute={A.LEFT}
                sourceAttribute={A.LEFT}
                constant={dividerOffset}
            />
        )}
    </>
);

const renderHorizontalConstraints = () => (
    <>
        <ConstraintLayout.Constraint
            target="button1"
            targetAttribute={A.START}
            sourceAttribute={A.START}
            constant={8}
        />
        <ConstraintLayout.Constraint
            target="button1"
            targetAttribute={A.END}
            source="divider"
            sourceAttribute={A.START}
        />
        <ConstraintLayout.Constraint
            target="button2"
            targetAttribute={A.START}
            source="divider"
            sourceAttribute={A.END}
        />
        <ConstraintLayout.Constraint target="button2" targetAttribute={A.END} sourceAttribute={A.END} constant={-8} />
        <ConstraintLayout.Constraint
            target="button3"
            targetAttribute={A.START}
            sourceAttribute={A.START}
            constant={8}
        />
        <ConstraintLayout.Constraint
            target="button3"
            targetAttribute={A.END}
            source="divider"
            sourceAttribute={A.START}
        />
    </>
);

const renderVerticalConstraints = () => (
    <>
        <TopEdgeConstraint />
        <ConstraintLayout.Constraint
            target="button2"
            targetAttribute={A.TOP}
            source="button1"
            sourceAttribute={A.BOTTOM}
        />
        <ConstraintLayout.Constraint
            target="button3"
            targetAttribute={A.TOP}
            source="button2"
            sourceAttribute={A.BOTTOM}
        />
        <BottomEdgeConstraint />
    </>
);

const renderLayout = (dividerOffset: number | null) => (
    <ConstraintLayout>
        {renderDividerConstraints(dividerOffset)}
        {renderHorizontalConstraints()}
        {renderVerticalConstraints()}
    </ConstraintLayout>
);

const ConstraintsInteractive = () => {
    const [dividerOffset, setDividerOffset] = useState<number | null>(null);

    return (
        <ConstraintContainer
            layoutManager={renderLayout(dividerOffset)}
            controllers={
                <GtkGestureDrag
                    onDragUpdate={(offsetX, _offsetY, self) => {
                        const [success, startX] = self.getStartPoint();
                        if (success) setDividerOffset(startX + offsetX);
                    }}
                />
            }
        />
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
