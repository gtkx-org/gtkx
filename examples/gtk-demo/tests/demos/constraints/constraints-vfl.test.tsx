import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { constraintsVflDemo } from "../../../src/demos/constraints/constraints-vfl.js";
import { renderDemo, screen } from "../../test-utils.js";

const getBox = async (): Promise<Gtk.Box> => {
    const button = (await screen.findByName("button1")) as Gtk.Button;
    const box = button.getParent();
    if (!(box instanceof Gtk.Box)) throw new Error("expected button1 to be inside a GtkBox");
    return box;
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
        const box = await getBox();
        expect(box.getLayoutManager()).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("adds the VFL-derived constraints to the layout", async () => {
        await renderDemo(constraintsVflDemo);
        const box = await getBox();
        const layout = box.getLayoutManager() as Gtk.ConstraintLayout;
        const observer = layout.observeConstraints();
        expect(observer.getNItems()).toBeGreaterThanOrEqual(10);
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
});
