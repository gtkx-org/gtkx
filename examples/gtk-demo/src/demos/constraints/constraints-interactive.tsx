import type { ReactElement, ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkConstraint, GtkConstraintGuide, GtkConstraintLayout, GtkGestureDrag } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import { type ChildButtons, useChildButtons } from "./child-buttons.js";
import {
    bottomEdgeConstraint,
    ConstraintContainer,
    endEdgeConstraint,
    startEdgeConstraint,
    topEdgeConstraint,
} from "./constraint-helpers.js";
import sourceCode from "./constraints-interactive.tsx?raw";

const A = Gtk.ConstraintAttribute;

const constraintsInteractiveDemo: Demo = {
    id: "constraints-interactive",
    title: "Constraints/Interactive Constraints",
    description:
        "This example shows how constraints can be updated during user interaction. The vertical edge between the " +
        "buttons can be dragged with the mouse.",
    keywords: ["GtkConstraintLayout"],
    component: ConstraintsInteractive,
    sourceCode,
    defaultWidth: 260,
};

const renderDividerConstraints = (divider: Gtk.ConstraintGuide, dividerOffset: number | null): ReactNode => (
    <>
        <GtkConstraint target={divider} targetAttribute={A.WIDTH} sourceAttribute={A.NONE} constant={0} />
        {dividerOffset === null ? null : (
            <GtkConstraint
                key={dividerOffset}
                target={divider}
                targetAttribute={A.LEFT}
                sourceAttribute={A.LEFT}
                constant={dividerOffset}
            />
        )}
    </>
);

const renderHorizontalConstraints = (buttons: ChildButtons, divider: Gtk.ConstraintGuide): ReactNode => (
    <>
        {startEdgeConstraint(buttons.button1)}
        <GtkConstraint target={buttons.button1} targetAttribute={A.END} source={divider} sourceAttribute={A.START} />
        <GtkConstraint target={buttons.button2} targetAttribute={A.START} source={divider} sourceAttribute={A.END} />
        {endEdgeConstraint(buttons.button2)}
        {startEdgeConstraint(buttons.button3)}
        <GtkConstraint target={buttons.button3} targetAttribute={A.END} source={divider} sourceAttribute={A.START} />
    </>
);

const renderVerticalConstraints = (buttons: ChildButtons): ReactNode => (
    <>
        {topEdgeConstraint(buttons.button1)}
        <GtkConstraint
            target={buttons.button2}
            targetAttribute={A.TOP}
            source={buttons.button1}
            sourceAttribute={A.BOTTOM}
        />
        <GtkConstraint
            target={buttons.button3}
            targetAttribute={A.TOP}
            source={buttons.button2}
            sourceAttribute={A.BOTTOM}
        />
        {bottomEdgeConstraint(buttons.button3)}
    </>
);

const renderLayout = (
    buttons: ChildButtons | null,
    divider: Gtk.ConstraintGuide | null,
    dividerRef: (guide: Gtk.ConstraintGuide | null) => void,
    dividerOffset: number | null,
): ReactElement => (
    <GtkConstraintLayout
        guides={<GtkConstraintGuide ref={dividerRef} name="divider" />}
        constraints={
            buttons &&
            divider && (
                <>
                    {renderDividerConstraints(divider, dividerOffset)}
                    {renderHorizontalConstraints(buttons, divider)}
                    {renderVerticalConstraints(buttons)}
                </>
            )
        }
    />
);

function ConstraintsInteractive() {
    const [buttons, handlers] = useChildButtons();
    const [divider, setDivider] = useState<Gtk.ConstraintGuide | null>(null);
    const [dividerOffset, setDividerOffset] = useState<number | null>(null);

    return (
        <ConstraintContainer
            handlers={handlers}
            layoutManager={renderLayout(buttons, divider, setDivider, dividerOffset)}
            controllers={
                <GtkGestureDrag
                    onDragUpdate={(offsetX, _offsetY, self) => {
                        const [success, startX] = self.getStartPoint();

                        if (success) {
                            setDividerOffset(startX + offsetX);
                        }
                    }}
                />
            }
        />
    );
}

export { constraintsInteractiveDemo };
