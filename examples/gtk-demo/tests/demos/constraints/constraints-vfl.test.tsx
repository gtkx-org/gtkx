import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { constraintsVflDemo } from "../../../src/demos/constraints/constraints-vfl.js";
import { renderDemo } from "../../test-utils.js";

const collectConstraints = (layout: Gtk.ConstraintLayout): Gtk.Constraint[] => {
    const observer = layout.observeConstraints();
    const constraints: Gtk.Constraint[] = [];
    for (let i = 0; i < observer.getNItems(); i++) {
        const item = observer.getItem(i);
        if (item instanceof Gtk.Constraint) constraints.push(item);
    }
    return constraints;
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
        const child1 = (await screen.findByName("button1")) as Gtk.Button;
        const child2 = (await screen.findByName("button2")) as Gtk.Button;
        const child3 = (await screen.findByName("button3")) as Gtk.Button;
        expect(child1.getLabel()).toBe("Child 1");
        expect(child2.getLabel()).toBe("Child 2");
        expect(child3.getLabel()).toBe("Child 3");
    });

    it("emits one constraint per non-trivial VFL clause", async () => {
        await renderDemo(constraintsVflDemo);
        const box = (await screen.findByName("container")) as Gtk.Box;
        const layout = box.getLayoutManager() as Gtk.ConstraintLayout;
        const constraints = collectConstraints(layout);
        expect(constraints.length).toBeGreaterThanOrEqual(10);
    });

    it("includes a width-equality constraint between button1 and button2", async () => {
        await renderDemo(constraintsVflDemo);
        const button1 = (await screen.findByName("button1")) as Gtk.Button;
        const button2 = (await screen.findByName("button2")) as Gtk.Button;
        const box = (await screen.findByName("container")) as Gtk.Box;
        const layout = box.getLayoutManager() as Gtk.ConstraintLayout;
        const constraints = collectConstraints(layout);

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
        await renderDemo(constraintsVflDemo);
        const button1 = (await screen.findByName("button1")) as Gtk.Button;
        const button3 = (await screen.findByName("button3")) as Gtk.Button;
        const box = (await screen.findByName("container")) as Gtk.Box;
        const layout = box.getLayoutManager() as Gtk.ConstraintLayout;
        const constraints = collectConstraints(layout);

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
        await renderDemo(constraintsVflDemo);
        const button1 = (await screen.findByName("button1")) as Gtk.Button;
        const button2 = (await screen.findByName("button2")) as Gtk.Button;
        const box = (await screen.findByName("container")) as Gtk.Box;
        const layout = box.getLayoutManager() as Gtk.ConstraintLayout;
        const constraints = collectConstraints(layout);

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
