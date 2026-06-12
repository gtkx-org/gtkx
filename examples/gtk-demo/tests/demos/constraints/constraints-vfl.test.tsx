import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { constraintsVflDemo } from "../../../src/demos/constraints/constraints-vfl.js";
import { renderDemo } from "../../test-utils.js";
import {
    type ChildButtons,
    collectConstraints,
    expectChildButtonLabels,
    findChildButtons,
} from "./constraint-helpers.js";

interface VflContext extends ChildButtons {
    constraints: Gtk.Constraint[];
}

const renderVflDemo = async (): Promise<VflContext> => {
    await renderDemo(constraintsVflDemo);
    const buttons = await findChildButtons();
    const box = (await screen.findByName("container")) as Gtk.Box;
    const layout = box.getLayoutManager() as Gtk.ConstraintLayout;
    return { ...buttons, constraints: collectConstraints(layout) };
};

describe("constraintsVflDemo", () => {
    it("exposes the expected metadata", () => {
        expect(constraintsVflDemo.id).toBe("constraints-vfl");
        expect(constraintsVflDemo.title).toBe("Constraints/VFL");
        expect(constraintsVflDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(constraintsVflDemo.keywords)).toBe(true);
        expect(typeof constraintsVflDemo.sourceCode).toBe("string");
        expect(constraintsVflDemo.defaultWidth).toBe(260);
    });

    it("attaches a GtkConstraintLayout manager to the container box", async () => {
        await renderDemo(constraintsVflDemo);
        const box = (await screen.findByName("container")) as Gtk.Box;
        expect(box).toBeInstanceOf(Gtk.Box);
        expect(box.getLayoutManager()).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("renders the three child buttons of the VFL demo", async () => {
        await renderDemo(constraintsVflDemo);
        await expectChildButtonLabels();
    });

    it("emits one constraint per non-trivial VFL clause", async () => {
        const { constraints } = await renderVflDemo();
        expect(constraints.length).toBeGreaterThanOrEqual(10);
    });

    it("includes a width-equality constraint between button1 and button2", async () => {
        const { button1, button2, constraints } = await renderVflDemo();

        const equality = constraints.find((c) => {
            const target = c.getTarget();
            const source = c.getSource();
            if (target !== button1 || source !== button2) return false;
            if (c.getTargetAttribute() !== Gtk.ConstraintAttribute.WIDTH) return false;
            if (c.getSourceAttribute() !== Gtk.ConstraintAttribute.WIDTH) return false;
            return c.getRelation() === Gtk.ConstraintRelation.EQ && c.getMultiplier() === 1;
        });
        expect(equality, "expected a width(button1) == width(button2) constraint").toBeDefined();
    });

    it("includes a height-equality constraint pairing button3 with button1", async () => {
        const { button1, button3, constraints } = await renderVflDemo();

        const equality = constraints.find((c) => {
            const target = c.getTarget();
            const source = c.getSource();
            if (target !== button3 || source !== button1) return false;
            return (
                c.getTargetAttribute() === Gtk.ConstraintAttribute.HEIGHT &&
                c.getSourceAttribute() === Gtk.ConstraintAttribute.HEIGHT
            );
        });
        expect(equality, "expected a height(button3) == height(button1) constraint").toBeDefined();
    });

    it("includes a 12-pixel spacing constraint between button1 and button2", async () => {
        const { button1, button2, constraints } = await renderVflDemo();

        const spacing = constraints.find((c) => {
            const target = c.getTarget();
            const source = c.getSource();
            const pairs = (target === button2 && source === button1) || (target === button1 && source === button2);
            if (!pairs) return false;
            return Math.abs(c.getConstant()) === 12;
        });
        expect(spacing, "expected a 12-unit gap constraint between button1 and button2").toBeDefined();
    });
});
