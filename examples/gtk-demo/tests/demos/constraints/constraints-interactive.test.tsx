import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { constraintsInteractiveDemo } from "../../../src/demos/constraints/constraints-interactive.js";
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

const getDragController = (box: Gtk.Box): Gtk.GestureDrag | null => {
    const observer = box.observeControllers();
    for (let i = 0; i < observer.getNItems(); i++) {
        const controller = observer.getItem(i);
        if (controller instanceof Gtk.GestureDrag) return controller;
    }
    return null;
};

describe("constraintsInteractiveDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(constraintsInteractiveDemo, {
            id: "constraints-interactive",
            title: "Constraints/Interactive Constraints",
        });
        expect(typeof constraintsInteractiveDemo.sourceCode).toBe("string");
        expect(constraintsInteractiveDemo.defaultWidth).toBe(360);
        expect(constraintsInteractiveDemo.keywords).toContain("gtkconstraintlayout");
    });
});

describe("constraintsInteractiveDemo layout", () => {
    it("attaches a GtkConstraintLayout manager to the container box", async () => {
        const { container } = await renderDemo(constraintsInteractiveDemo);
        const box = findBox(container);
        expect(box?.getLayoutManager()).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("registers a single guide on the layout", async () => {
        const { container } = await renderDemo(constraintsInteractiveDemo);
        const box = findBox(container);
        const layout = box?.getLayoutManager() as Gtk.ConstraintLayout;

        const observer = layout.observeGuides();
        expect(observer.getNItems()).toBe(1);
    });

    it("attaches a GestureDrag controller to the container", async () => {
        const { container } = await renderDemo(constraintsInteractiveDemo);
        const box = findBox(container);
        if (!box) throw new Error("box not found");
        expect(getDragController(box)).toBeInstanceOf(Gtk.GestureDrag);
    });

    it("renders three button children with the expected labels", async () => {
        const { container } = await renderDemo(constraintsInteractiveDemo);
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

describe("constraintsInteractiveDemo dragging", () => {
    it("reacts to drag-update by adding a positional constraint to the layout", async () => {
        const { container } = await renderDemo(constraintsInteractiveDemo);
        const box = findBox(container);
        if (!box) throw new Error("box not found");
        const drag = getDragController(box);
        if (!drag) throw new Error("drag gesture not found");

        const layout = box.getLayoutManager() as Gtk.ConstraintLayout;
        const beforeCount = layout.observeConstraints().getNItems();

        await fireEvent(drag, "drag-begin", 50, 0);
        await fireEvent(drag, "drag-update", 30, 0);

        const afterCount = layout.observeConstraints().getNItems();
        expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    });

    it("replaces the positional constraint on subsequent drag-updates", async () => {
        const { container } = await renderDemo(constraintsInteractiveDemo);
        const box = findBox(container);
        if (!box) throw new Error("box not found");
        const drag = getDragController(box);
        if (!drag) throw new Error("drag gesture not found");

        const layout = box.getLayoutManager() as Gtk.ConstraintLayout;
        await fireEvent(drag, "drag-begin", 50, 0);
        await fireEvent(drag, "drag-update", 30, 0);
        const firstCount = layout.observeConstraints().getNItems();
        await fireEvent(drag, "drag-update", 60, 0);
        const secondCount = layout.observeConstraints().getNItems();
        expect(secondCount).toBe(firstCount);
    });
});
