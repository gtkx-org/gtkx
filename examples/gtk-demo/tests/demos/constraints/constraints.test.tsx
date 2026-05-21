import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { constraintsDemo } from "../../../src/demos/constraints/constraints.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

const findBox = (root: Gtk.Widget): Gtk.Box | null => {
    if (root instanceof Gtk.Box && root.getFirstChild() instanceof Gtk.Button) return root;
    let child = root.getFirstChild();
    while (child) {
        const found = findBox(child);
        if (found) return found;
        child = child.getNextSibling();
    }
    return null;
};

describe("constraintsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(constraintsDemo, {
            id: "constraints",
            title: "Constraints/Simple Constraints",
        });
        expect(typeof constraintsDemo.sourceCode).toBe("string");
        expect(constraintsDemo.defaultWidth).toBe(260);
        expect(constraintsDemo.keywords).toContain("GtkConstraintLayout");
    });
});

describe("constraintsDemo layout", () => {
    it("attaches a GtkConstraintLayout manager to the container box", async () => {
        const { container } = await renderDemo(constraintsDemo);
        const box = findBox(container);
        expect(box).toBeInstanceOf(Gtk.Box);
        const layoutManager = box?.getLayoutManager();
        expect(layoutManager).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("registers a single named spacing guide on the layout", async () => {
        const { container } = await renderDemo(constraintsDemo);
        const box = findBox(container);
        const layout = box?.getLayoutManager() as Gtk.ConstraintLayout;

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
        const { container } = await renderDemo(constraintsDemo);
        const box = findBox(container);
        const layout = box?.getLayoutManager() as Gtk.ConstraintLayout;

        const observer = layout.observeConstraints();
        const count = observer.getNItems();
        expect(count).toBeGreaterThanOrEqual(15);
    });
});

describe("constraintsDemo children", () => {
    it("renders the three child buttons inside the constrained box", async () => {
        const { container } = await renderDemo(constraintsDemo);
        const box = findBox(container);
        if (!box) throw new Error("box not found");

        const labels: string[] = [];
        let child = box.getFirstChild();
        while (child) {
            if (child instanceof Gtk.Button) labels.push(child.getLabel() ?? "");
            child = child.getNextSibling();
        }
        expect(labels).toEqual(["Child 1", "Child 2", "Child 3"]);
    });
});
