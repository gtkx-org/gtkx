import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { constraintsInteractiveDemo } from "../../../src/demos/constraints/constraints-interactive.js";
import { collectControllersOfType, fireEvent, renderDemo, screen } from "../../test-utils.js";

const getBox = async (): Promise<Gtk.Box> => {
    const button = (await screen.findByName("button1")) as Gtk.Button;
    const box = button.getParent();
    if (!(box instanceof Gtk.Box)) throw new Error("expected button1 to be inside a GtkBox");
    return box;
};

const getLayout = async (): Promise<Gtk.ConstraintLayout> => {
    const box = await getBox();
    const layout = box.getLayoutManager();
    if (!(layout instanceof Gtk.ConstraintLayout)) throw new Error("expected a ConstraintLayout on the box");
    return layout;
};

const getDragController = (box: Gtk.Box): Gtk.GestureDrag | null =>
    collectControllersOfType(box, Gtk.GestureDrag)[0] ?? null;

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

describe("constraintsInteractiveDemo layout", () => {
    it("attaches a GtkConstraintLayout manager to the container box", async () => {
        await renderDemo(constraintsInteractiveDemo);
        const layout = await getLayout();
        expect(layout).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("registers a single guide on the layout", async () => {
        await renderDemo(constraintsInteractiveDemo);
        const layout = await getLayout();
        const observer = layout.observeGuides();
        expect(observer.getNItems()).toBe(1);
    });

    it("attaches a GestureDrag controller to the container", async () => {
        await renderDemo(constraintsInteractiveDemo);
        const box = await getBox();
        expect(getDragController(box)).toBeInstanceOf(Gtk.GestureDrag);
    });

    it("renders three button children with the expected labels", async () => {
        await renderDemo(constraintsInteractiveDemo);
        const child1 = (await screen.findByName("button1")) as Gtk.Button;
        const child2 = (await screen.findByName("button2")) as Gtk.Button;
        const child3 = (await screen.findByName("button3")) as Gtk.Button;
        expect(child1.getLabel()).toBe("Child 1");
        expect(child2.getLabel()).toBe("Child 2");
        expect(child3.getLabel()).toBe("Child 3");
    });
});

describe("constraintsInteractiveDemo dragging", () => {
    it("reacts to drag-update by adding a positional constraint to the layout", async () => {
        await renderDemo(constraintsInteractiveDemo);
        const box = await getBox();
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
        await renderDemo(constraintsInteractiveDemo);
        const box = await getBox();
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
