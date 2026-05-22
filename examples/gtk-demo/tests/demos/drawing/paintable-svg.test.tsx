import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { paintableSvgDemo } from "../../../src/demos/drawing/paintable-svg.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findApplicationWindow } from "../../helpers/traverse.js";

const findOpenButton = async (): Promise<Gtk.Button> =>
    (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;

describe("paintableSvgDemo", () => {
    it("exposes the expected metadata", () => {
        expect(paintableSvgDemo.id).toBe("paintable-svg");
        expect(paintableSvgDemo.title).toBe("Paintable/SVG");
        expect(paintableSvgDemo.description.length).toBeGreaterThan(0);
        expect(paintableSvgDemo.keywords).toEqual(expect.arrayContaining(["gtkpicture", "gtksvg"]));
        expect(typeof paintableSvgDemo.sourceCode).toBe("string");
        expect(paintableSvgDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(paintableSvgDemo.defaultWidth).toBe(330);
        expect(paintableSvgDemo.defaultHeight).toBe(330);
        expect(paintableSvgDemo.component).toBeTypeOf("function");
    });

    it("renders the Open button in the header bar", async () => {
        await renderDemo(paintableSvgDemo);
        const openButton = await findOpenButton();
        expect(openButton).toBeInstanceOf(Gtk.Button);
        expect(openButton.getUseUnderline()).toBe(true);
    });

    it("renders a drawing area for the non-symbolic default SVG path", async () => {
        await renderDemo(paintableSvgDemo);
        const drawing = (await screen.findByName("drawing-area")) as Gtk.DrawingArea;
        expect(drawing).toBeInstanceOf(Gtk.DrawingArea);
        expect(drawing.getHexpand()).toBe(true);
        expect(drawing.getVexpand()).toBe(true);
    });

    it("renders a header bar containing the Open button", async () => {
        const { container } = await renderDemo(paintableSvgDemo);
        const window = findApplicationWindow(container);
        if (!window) throw new Error("window not found");
        expect(window.getTitlebar()).toBeInstanceOf(Gtk.HeaderBar);
    });

    it("wires the open button as a useUnderline-enabled action button", async () => {
        const { container } = await renderDemo(paintableSvgDemo);
        const openButton = await findOpenButton();
        expect(openButton).toBeInstanceOf(Gtk.Button);
        expect(openButton.getUseUnderline()).toBe(true);
        const window = findApplicationWindow(container);
        const headerBar = window?.getTitlebar();
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
