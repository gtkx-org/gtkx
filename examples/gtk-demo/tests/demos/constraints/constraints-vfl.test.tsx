import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import type { ChildButtons } from "../../../src/demos/constraints/child-buttons.js";
import { constraintsVflDemo } from "../../../src/demos/constraints/constraints-vfl.js";
import { renderDemo } from "../../test-utils.js";
import {
    CHILD_BUTTON_LABELS,
    collectConstraints,
    findChildButtons,
    findLabelledChildButtons,
} from "./constraint-helpers.js";

type VflContext = {
    constraints: Gtk.Constraint[];
} & ChildButtons;

const SPACING = 8;
const BUTTON_GAP = 12;

const renderVflDemo = async (): Promise<VflContext> => {
    await renderDemo(constraintsVflDemo);
    const buttons = await findChildButtons();
    const box = await screen.findByName("container", { as: Gtk.Box });
    const layout = box.getLayoutManager() as Gtk.ConstraintLayout;

    return { ...buttons, constraints: collectConstraints(layout) };
};

const isSameAttributeOnBothEnds = (constraint: Gtk.Constraint, attribute: Gtk.ConstraintAttribute): boolean =>
    constraint.getTargetAttribute() === attribute && constraint.getSourceAttribute() === attribute;

const isPairing = (constraint: Gtk.Constraint, target: Gtk.Widget, source: Gtk.Widget): boolean =>
    constraint.getTarget() === target && constraint.getSource() === source;

const isTouchingSuperview = (constraint: Gtk.Constraint): boolean =>
    constraint.getTarget() === null || constraint.getSource() === null;

const isTouching = (constraint: Gtk.Constraint, widget: Gtk.Widget): boolean =>
    constraint.getTarget() === widget || constraint.getSource() === widget;

const isWidthEquality = ({ button1, button2 }: VflContext, constraint: Gtk.Constraint): boolean =>
    isPairing(constraint, button1, button2) &&
    isSameAttributeOnBothEnds(constraint, Gtk.ConstraintAttribute.WIDTH) &&
    constraint.getRelation() === Gtk.ConstraintRelation.EQ &&
    constraint.getMultiplier() === 1;

const isHeightEquality = ({ button1, button3 }: VflContext, constraint: Gtk.Constraint): boolean =>
    isPairing(constraint, button3, button1) &&
    isSameAttributeOnBothEnds(constraint, Gtk.ConstraintAttribute.HEIGHT);

const isButtonGap = ({ button1, button2 }: VflContext, constraint: Gtk.Constraint): boolean =>
    (isPairing(constraint, button2, button1) || isPairing(constraint, button1, button2)) &&
    Math.abs(constraint.getConstant()) === BUTTON_GAP;

const isSuperviewGap = (
    { button1 }: VflContext,
    constraint: Gtk.Constraint,
    attribute: Gtk.ConstraintAttribute,
): boolean =>
    isTouchingSuperview(constraint) &&
    isTouching(constraint, button1) &&
    isSameAttributeOnBothEnds(constraint, attribute) &&
    Math.abs(constraint.getConstant()) === SPACING;

const hasAttributeOnWidgetEnd = (
    constraint: Gtk.Constraint,
    widget: Gtk.Widget,
    attribute: Gtk.ConstraintAttribute,
): boolean => {
    if (constraint.getTarget() === widget) {
        return constraint.getTargetAttribute() === attribute;
    }

    if (constraint.getSource() === widget) {
        return constraint.getSourceAttribute() === attribute;
    }

    return false;
};

const isSuperviewEdge = (
    { button3 }: VflContext,
    constraint: Gtk.Constraint,
    attribute: Gtk.ConstraintAttribute,
): boolean => isTouchingSuperview(constraint) && hasAttributeOnWidgetEnd(constraint, button3, attribute);

const findSuperviewGap = (context: VflContext, attribute: Gtk.ConstraintAttribute): Gtk.Constraint | undefined =>
    context.constraints.find((constraint) => isSuperviewGap(context, constraint, attribute));

const findSuperviewEdge = (context: VflContext, attribute: Gtk.ConstraintAttribute): Gtk.Constraint | undefined =>
    context.constraints.find((constraint) => isSuperviewEdge(context, constraint, attribute));

describe("constraintsVflDemo", () => {
    it("attaches a GtkConstraintLayout manager to the container box", async () => {
        await renderDemo(constraintsVflDemo);
        const box = await screen.findByName("container", { as: Gtk.Box });
        expect(box.getLayoutManager()).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("renders the three child buttons of the VFL demo", async () => {
        await renderDemo(constraintsVflDemo);
        const buttons = await findLabelledChildButtons();
        expect(buttons.map((button) => button.getLabel())).toEqual(CHILD_BUTTON_LABELS);
    });

    it("emits exactly the constraints the four VFL lines expand to", async () => {
        const { constraints } = await renderVflDemo();
        expect(constraints).toHaveLength(14);
    });
});

describe("constraintsVflDemo button relationships", () => {
    it("includes a width-equality constraint between button1 and button2", async () => {
        const context = await renderVflDemo();
        const equality = context.constraints.find((constraint) => isWidthEquality(context, constraint));
        expect(equality, "expected a width(button1) == width(button2) constraint").toBeDefined();
    });

    it("includes a height-equality constraint pairing button3 with button1", async () => {
        const context = await renderVflDemo();
        const equality = context.constraints.find((constraint) => isHeightEquality(context, constraint));
        expect(equality, "expected a height(button3) == height(button1) constraint").toBeDefined();
    });

    it("includes a 12-pixel spacing constraint between button1 and button2", async () => {
        const context = await renderVflDemo();
        const spacing = context.constraints.find((constraint) => isButtonGap(context, constraint));
        expect(spacing, "expected a 12-unit gap constraint between button1 and button2").toBeDefined();
    });
});

describe("constraintsVflDemo superview relationships", () => {
    it("materializes the default hspacing/vspacing of 8 as leading superview gaps", async () => {
        const context = await renderVflDemo();

        expect(
            findSuperviewGap(context, Gtk.ConstraintAttribute.START),
            "expected an 8-unit horizontal gap (hspacing) between the superview and button1",
        ).toBeDefined();

        expect(
            findSuperviewGap(context, Gtk.ConstraintAttribute.TOP),
            "expected an 8-unit vertical gap (vspacing) between the superview and button1",
        ).toBeDefined();
    });

    it("binds button3 to the superview edges for the H:|-[button3]-| line", async () => {
        const context = await renderVflDemo();

        expect(
            findSuperviewEdge(context, Gtk.ConstraintAttribute.START),
            "expected button3.start bound to the superview leading edge",
        ).toBeDefined();

        expect(
            findSuperviewEdge(context, Gtk.ConstraintAttribute.END),
            "expected button3.end bound to the superview trailing edge",
        ).toBeDefined();
    });
});
