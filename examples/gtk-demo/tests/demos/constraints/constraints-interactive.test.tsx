import * as Gtk from "@gtkx/gi/gtk";
import { userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { constraintsInteractiveDemo } from "../../../src/demos/constraints/constraints-interactive.js";
import { renderDemo } from "../../test-utils.js";
import { expectChildButtonLabels, findChildButtons, findContainerLayout } from "./constraint-helpers.js";

const findDividerLeftConstant = (layout: Gtk.ConstraintLayout): number | null => {
    const observer = layout.observeConstraints();
    for (let i = 0; i < observer.getNItems(); i++) {
        const item = observer.getItem(i);
        if (!(item instanceof Gtk.Constraint)) continue;
        if (item.getTargetAttribute() !== Gtk.ConstraintAttribute.LEFT) continue;
        const target = item.getTarget();
        if (target instanceof Gtk.ConstraintGuide && target.getName() === "divider") {
            return item.getConstant();
        }
    }
    return null;
};

describe("constraintsInteractiveDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(constraintsInteractiveDemo.id).toBe("constraints-interactive");
        expect(constraintsInteractiveDemo.title).toBe("Constraints/Interactive Constraints");
        expect(constraintsInteractiveDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(constraintsInteractiveDemo.keywords)).toBe(true);
        expect(typeof constraintsInteractiveDemo.sourceCode).toBe("string");
        expect(constraintsInteractiveDemo.defaultWidth).toBe(260);
        expect(constraintsInteractiveDemo.keywords).toContain("GtkConstraintLayout");
    });
});

describe("constraintsInteractiveDemo content", () => {
    it("renders three button children with the expected labels", async () => {
        await renderDemo(constraintsInteractiveDemo);
        await expectChildButtonLabels();
    });
});

describe("constraintsInteractiveDemo dragging", () => {
    it("leaves the divider unpinned until the user drags", async () => {
        await renderDemo(constraintsInteractiveDemo);
        const { box, layout } = await findContainerLayout();
        expect(findDividerLeftConstant(layout)).toBeNull();

        await userEvent.drag(box, 30, 0);

        await waitFor(() => expect(findDividerLeftConstant(layout)).not.toBeNull());
    });

    it("re-solves the layout against the dragged divider position", async () => {
        await renderDemo(constraintsInteractiveDemo);
        const { box, layout } = await findContainerLayout();
        const { button1 } = await findChildButtons();

        await userEvent.drag(box, 130, 0);

        await waitFor(() => {
            const dividerLeft = findDividerLeftConstant(layout);
            expect(dividerLeft).not.toBeNull();
            expect(button1.getAllocatedWidth()).toBe((dividerLeft as number) - 8);
        });
    });
});
