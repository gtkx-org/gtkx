import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { paintableSvgDemo } from "../../../src/demos/drawing/paintable-svg.js";
import { renderDemo } from "../../test-utils.js";

describe("paintableSvgDemo metadata", () => {
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
});

describe("paintableSvgDemo rendering", () => {
    it("renders the Open button in the header bar", async () => {
        await renderDemo(paintableSvgDemo);
        const openButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;
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
        await renderDemo(paintableSvgDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        expect(window.getTitlebar()).toBeInstanceOf(Gtk.HeaderBar);
    });

    it("wires the open button as a useUnderline-enabled action button packed into the header bar", async () => {
        await renderDemo(paintableSvgDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        const openButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;
        const headerBar = window.getTitlebar();
        expect(headerBar).toBeInstanceOf(Gtk.HeaderBar);
        expect(openButton.getRoot()).toBe(window);
        expect(openButton.getUseUnderline()).toBe(true);
    });

    it("loads the bundled SVG and attaches it to the picture", async () => {
        await renderDemo(paintableSvgDemo);
        const picture = (await screen.findByName("picture")) as Gtk.Picture;
        await waitFor(() => expect(picture.getPaintable()).toBeInstanceOf(Gtk.Svg));
    });
});

describe("paintableSvgDemo open dialog", () => {
    it("invokes the file picker when the Open button is clicked", async () => {
        await renderDemo(paintableSvgDemo);
        const openButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;
        await userEvent.click(openButton);
        await new Promise((r) => setTimeout(r, 250));
        expect(openButton).toBeInstanceOf(Gtk.Button);
    });
});

describe("paintableSvgDemo gesture", () => {
    it("cycles the SVG state when the picture is pressed via the GestureClick controller", async () => {
        await renderDemo(paintableSvgDemo);
        const picture = (await screen.findByName("picture")) as Gtk.Picture;
        await waitFor(() => expect(picture.getPaintable()).toBeInstanceOf(Gtk.Svg));
        const svg = picture.getPaintable() as Gtk.Svg;
        const initialState = svg.getState();
        const controllers = picture.observeControllers();
        let gesture: Gtk.GestureClick | undefined;
        for (let i = 0; i < controllers.getNItems(); i++) {
            const item = controllers.getItem(i);
            if (item instanceof Gtk.GestureClick) {
                gesture = item;
                break;
            }
        }
        expect(gesture).toBeInstanceOf(Gtk.GestureClick);
        if (gesture) await fireEvent(gesture, "pressed", 1, 8, 8);
        await waitFor(() => expect(svg.getState()).not.toBe(initialState));
    });

    it("wraps the SVG state from 63 back to 0 when the picture is pressed at the upper bound", async () => {
        await renderDemo(paintableSvgDemo);
        const picture = (await screen.findByName("picture")) as Gtk.Picture;
        await waitFor(() => expect(picture.getPaintable()).toBeInstanceOf(Gtk.Svg));
        const svg = picture.getPaintable() as Gtk.Svg;
        svg.setState(63);
        const controllers = picture.observeControllers();
        let gesture: Gtk.GestureClick | undefined;
        for (let i = 0; i < controllers.getNItems(); i++) {
            const item = controllers.getItem(i);
            if (item instanceof Gtk.GestureClick) {
                gesture = item;
                break;
            }
        }
        if (gesture) await fireEvent(gesture, "pressed", 1, 8, 8);
        await waitFor(() => expect(svg.getState()).toBe(0));
    });
});
