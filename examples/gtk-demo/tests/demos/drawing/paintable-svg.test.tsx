import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { paintableSvgDemo } from "../../../src/demos/drawing/paintable-svg.js";
import { renderDemo, screen } from "../../test-utils.js";

const findOpenButton = async (): Promise<Gtk.Button> =>
    (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;

describe("paintableSvgDemo", () => {
    it("exposes the expected metadata", () => {
        expect(paintableSvgDemo.id).toBe("paintable-svg");
        expect(paintableSvgDemo.title).toBe("Paintable/SVG");
        expect(paintableSvgDemo.description.length).toBeGreaterThan(0);
        expect(paintableSvgDemo.keywords).toEqual([]);
        expect(paintableSvgDemo.windowTitle).toBe("Paintable — SVG");
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

    it("renders a GtkPicture displaying the SVG paintable", async () => {
        await renderDemo(paintableSvgDemo);
        const picture = (await screen.findByName("picture")) as Gtk.Picture;
        expect(picture).toBeInstanceOf(Gtk.Picture);
        const [width, height] = picture.getSizeRequest();
        expect(width).toBe(16);
        expect(height).toBe(16);
    });

    it("renders a header bar containing the Open button", async () => {
        const { window } = await renderDemo(paintableSvgDemo);
        const win = window.current;
        if (!win) throw new Error("window not found");
        expect(win.getTitlebar()).toBeInstanceOf(Gtk.HeaderBar);
    });

    it("wires the open button as a useUnderline-enabled action button", async () => {
        const { window } = await renderDemo(paintableSvgDemo);
        const openButton = await findOpenButton();
        expect(openButton).toBeInstanceOf(Gtk.Button);
        expect(openButton.getUseUnderline()).toBe(true);
        const win = window.current;
        const headerBar = win?.getTitlebar();
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
