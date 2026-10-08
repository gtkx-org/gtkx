import type { ReactElement, ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkConstraint, GtkConstraintGuide, GtkConstraintLayout } from "@gtkx/jsx/gtk";
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
import sourceCode from "./constraints.tsx?raw";

const A = Gtk.ConstraintAttribute;
const R = Gtk.ConstraintRelation;
const S = Gtk.ConstraintStrength;

const constraintsDemo: Demo = {
    id: "constraints",
    title: "Constraints/Simple Constraints",
    description:
        "GtkConstraintLayout provides a layout manager that uses relations between widgets (also known as " +
        "“constraints”) to compute the position and size of each child.\n\nIn addition to child widgets, the " +
        "constraints can involve spacer objects (also known as “guides”). This example has a guide between the two " +
        "buttons in the top row.\n\nTry resizing the window to see how the constraints react to update the layout.",
    keywords: ["GtkLayoutManager"],
    component: ConstraintsDemo,
    sourceCode,
    defaultWidth: 260,
};

const renderHorizontalConstraints = (buttons: ChildButtons, space: Gtk.ConstraintGuide): ReactNode => (
    <>
        <GtkConstraint
            target={buttons.button1}
            targetAttribute={A.WIDTH}
            relation={R.LE}
            sourceAttribute={A.NONE}
            constant={200}
        />
        {startEdgeConstraint(buttons.button1)}
        <GtkConstraint
            target={buttons.button1}
            targetAttribute={A.WIDTH}
            source={buttons.button2}
            sourceAttribute={A.WIDTH}
        />
        <GtkConstraint target={buttons.button1} targetAttribute={A.END} source={space} sourceAttribute={A.START} />
        <GtkConstraint target={space} targetAttribute={A.END} source={buttons.button2} sourceAttribute={A.START} />
        {endEdgeConstraint(buttons.button2)}
        {startEdgeConstraint(buttons.button3)}
        {endEdgeConstraint(buttons.button3)}
    </>
);

const stackedAboveConstraint = (target: Gtk.ConstraintTarget, source: Gtk.ConstraintTarget): ReactNode => (
    <GtkConstraint target={target} targetAttribute={A.BOTTOM} source={source} sourceAttribute={A.TOP} constant={-12} />
);

const sameHeightConstraint = (target: Gtk.ConstraintTarget, source: Gtk.ConstraintTarget): ReactNode => (
    <GtkConstraint target={target} targetAttribute={A.HEIGHT} source={source} sourceAttribute={A.HEIGHT} />
);

const renderVerticalConstraints = (buttons: ChildButtons): ReactNode => (
    <>
        {topEdgeConstraint(buttons.button1)}
        <GtkConstraint target={buttons.button2} targetAttribute={A.TOP} sourceAttribute={A.TOP} constant={8} />
        {stackedAboveConstraint(buttons.button1, buttons.button3)}
        {stackedAboveConstraint(buttons.button2, buttons.button3)}
        {sameHeightConstraint(buttons.button3, buttons.button1)}
        {sameHeightConstraint(buttons.button3, buttons.button2)}
        {bottomEdgeConstraint(buttons.button3)}
    </>
);

const renderLayout = (
    buttons: ChildButtons | null,
    space: Gtk.ConstraintGuide | null,
    spaceRef: (guide: Gtk.ConstraintGuide | null) => void,
): ReactElement => (
    <GtkConstraintLayout
        guides={
            <GtkConstraintGuide
                ref={spaceRef}
                name="space"
                minWidth={10}
                minHeight={10}
                natWidth={100}
                natHeight={10}
                maxWidth={200}
                maxHeight={20}
                strength={S.STRONG}
            />
        }
        constraints={
            buttons &&
            space && (
                <>
                    {renderHorizontalConstraints(buttons, space)}
                    {renderVerticalConstraints(buttons)}
                </>
            )
        }
    />
);

function ConstraintsDemo() {
    const [buttons, handlers] = useChildButtons();
    const [space, setSpace] = useState<Gtk.ConstraintGuide | null>(null);

    return <ConstraintContainer handlers={handlers} layoutManager={renderLayout(buttons, space, setSpace)} />;
}

export { constraintsDemo };
