import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { constraintsDemo } from "../../../src/demos/constraints/constraints.js";
import { renderDemo, screen } from "../../test-utils.js";

const getGridLayout = async (): Promise<Gtk.ConstraintLayout> => {
    const button = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 1" })) as Gtk.Button;
    const parent = button.getParent();
    if (!parent) throw new Error("Child 1 has no parent");
    const layout = parent.getLayoutManager();
    if (!(layout instanceof Gtk.ConstraintLayout)) throw new Error("expected a ConstraintLayout on the parent");
    return layout;
};

describe("constraintsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(constraintsDemo.id).toBe("constraints");
        expect(constraintsDemo.title).toBe("Constraints/Simple Constraints");
        expect(constraintsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(constraintsDemo.keywords)).toBe(true);
        expect(typeof constraintsDemo.sourceCode).toBe("string");
        expect(constraintsDemo.defaultWidth).toBe(260);
        expect(constraintsDemo.keywords).toContain("GtkLayoutManager");
    });
});

describe("constraintsDemo layout", () => {
    it("mounts the demo body with a GtkConstraintLayout manager", async () => {
        await renderDemo(constraintsDemo);
        const layout = await getGridLayout();
        expect(layout).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("registers a single named spacing guide on the layout", async () => {
        await renderDemo(constraintsDemo);
        const layout = await getGridLayout();

        const guides: Gtk.ConstraintGuide[] = [];
        const observer = layout.observeGuides();
        for (let i = 0; i < observer.getNItems(); i++) {
            guides.push(observer.getItem(i) as Gtk.ConstraintGuide);
        }
        expect(guides).toHaveLength(1);
        expect(guides[0]?.getName()).toBe("space");

        const [minW, minH] = guides[0]?.getMinSize() ?? [0, 0];
        expect(minW).toBe(10);
        expect(minH).toBe(10);

        const [natW, natH] = guides[0]?.getNatSize() ?? [0, 0];
        expect(natW).toBe(100);
        expect(natH).toBe(10);

        const [maxW, maxH] = guides[0]?.getMaxSize() ?? [0, 0];
        expect(maxW).toBe(200);
        expect(maxH).toBe(20);

        expect(guides[0]?.getStrength()).toBe(Gtk.ConstraintStrength.STRONG);
    });

    it("adds many constraints to the layout", async () => {
        await renderDemo(constraintsDemo);
        const layout = await getGridLayout();
        const observer = layout.observeConstraints();
        expect(observer.getNItems()).toBeGreaterThanOrEqual(15);
    });
});

describe("constraintsDemo children", () => {
    it("renders the three child buttons inside the grid", async () => {
        await renderDemo(constraintsDemo);
        const child1 = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 1" })) as Gtk.Button;
        const child2 = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 2" })) as Gtk.Button;
        const child3 = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 3" })) as Gtk.Button;
        const grid = child1.getParent();
        expect(child2.getParent()).toBe(grid);
        expect(child3.getParent()).toBe(grid);
    });
});
