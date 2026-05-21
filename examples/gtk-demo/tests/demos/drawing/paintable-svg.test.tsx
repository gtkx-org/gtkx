import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { paintableSvgDemo } from "../../../src/demos/drawing/paintable-svg.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType, findFirstOfType } from "../../helpers/traverse.js";

describe("paintableSvgDemo", () => {
    it("exposes the expected metadata", () => {
        expect(paintableSvgDemo.id).toBe("paintable-svg");
        expect(paintableSvgDemo.title).toBe("Paintable/SVG");
        expect(paintableSvgDemo.description.length).toBeGreaterThan(0);
        expect(paintableSvgDemo.keywords).toEqual(
            expect.arrayContaining(["paintable", "svg", "vector", "scalable", "graphics"]),
        );
        expect(typeof paintableSvgDemo.sourceCode).toBe("string");
        expect(paintableSvgDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(paintableSvgDemo.defaultWidth).toBe(330);
        expect(paintableSvgDemo.defaultHeight).toBe(330);
        expect(paintableSvgDemo.component).toBeTypeOf("function");
    });

    it("renders the Open button in the header bar", async () => {
        const { container } = await renderDemo(paintableSvgDemo);
        const openButton = findButtonByLabel(container, "_Open");
        expect(openButton).toBeInstanceOf(Gtk.Button);
        if (!openButton) return;
        expect(openButton.getUseUnderline()).toBe(true);
    });

    it("renders a drawing area for the non-symbolic default SVG path", async () => {
        const { container } = await renderDemo(paintableSvgDemo);
        const drawing = findFirstOfType(container, Gtk.DrawingArea);
        expect(drawing).toBeInstanceOf(Gtk.DrawingArea);
        if (!drawing) return;
        expect(drawing.getHexpand()).toBe(true);
        expect(drawing.getVexpand()).toBe(true);
    });

    it("renders a header bar containing the Open button", async () => {
        const { container } = await renderDemo(paintableSvgDemo);
        const headerBar = findFirstOfType(container, Gtk.HeaderBar);
        expect(headerBar).toBeInstanceOf(Gtk.HeaderBar);
    });

    it("wires the open button as a useUnderline-enabled action button", async () => {
        const { container } = await renderDemo(paintableSvgDemo);
        const openButton = findButtonByLabel(container, "_Open");
        expect(openButton).toBeInstanceOf(Gtk.Button);
        if (!openButton) return;
        expect(openButton.getUseUnderline()).toBe(true);
        const headerBar = findFirstOfType(container, Gtk.HeaderBar);
        expect(openButton.getParent()).not.toBeNull();
        let parent: Gtk.Widget | null = openButton;
        let foundHeaderBar = false;
        while (parent) {
            if (parent === headerBar) {
                foundHeaderBar = true;
                break;
            }
            parent = parent.getParent();
        }
        expect(foundHeaderBar).toBe(true);
    });
});

const findButtonByLabel = (root: Gtk.Widget, label: string): Gtk.Button | null =>
    findAllOfType(root, Gtk.Button).find((b) => b.getLabel() === label) ?? null;
