import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { constraintsVflDemo } from "../../../src/demos/constraints/constraints-vfl.js";
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

describe("constraintsVflDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(constraintsVflDemo, {
            id: "constraints-vfl",
            title: "Constraints/VFL",
        });
        expect(typeof constraintsVflDemo.sourceCode).toBe("string");
        expect(constraintsVflDemo.defaultWidth).toBe(260);
    });

    it("attaches a GtkConstraintLayout manager to the container box", async () => {
        const { container } = await renderDemo(constraintsVflDemo);
        const box = findBox(container);
        expect(box?.getLayoutManager()).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("adds the VFL-derived constraints to the layout", async () => {
        const { container } = await renderDemo(constraintsVflDemo);
        const box = findBox(container);
        const layout = box?.getLayoutManager() as Gtk.ConstraintLayout;
        const observer = layout.observeConstraints();
        expect(observer.getNItems()).toBeGreaterThanOrEqual(10);
    });

    it("renders the three child buttons of the VFL demo", async () => {
        const { container } = await renderDemo(constraintsVflDemo);
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
