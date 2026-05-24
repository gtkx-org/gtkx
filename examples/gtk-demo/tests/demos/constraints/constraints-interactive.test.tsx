import type * as Gtk from "@gtkx/ffi/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { constraintsInteractiveDemo } from "../../../src/demos/constraints/constraints-interactive.js";
import { renderDemo } from "../../test-utils.js";

const findContainerBox = async (): Promise<Gtk.Box> => (await screen.findByName("container")) as Gtk.Box;

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
        const child1 = (await screen.findByName("button1")) as Gtk.Button;
        const child2 = (await screen.findByName("button2")) as Gtk.Button;
        const child3 = (await screen.findByName("button3")) as Gtk.Button;
        expect(child1.getLabel()).toBe("Child 1");
        expect(child2.getLabel()).toBe("Child 2");
        expect(child3.getLabel()).toBe("Child 3");
    });
});

describe("constraintsInteractiveDemo dragging", () => {
    it("adds a constraint to the layout when the user drags inside the container", async () => {
        await renderDemo(constraintsInteractiveDemo);
        const box = await findContainerBox();
        const layout = box.getLayoutManager() as Gtk.ConstraintLayout;
        const before = layout.observeConstraints().getNItems();

        await userEvent.drag(box, 30, 0);

        const after = layout.observeConstraints().getNItems();
        expect(after).toBeGreaterThan(before);
    });

    it("queues a layout pass on the container while dragging", async () => {
        await renderDemo(constraintsInteractiveDemo);
        const box = await findContainerBox();
        const queueAllocate = vi.spyOn(box, "queueAllocate");

        await userEvent.drag(box, 30, 0);

        expect(queueAllocate).toHaveBeenCalled();
    });
});
