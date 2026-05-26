import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import nodeEditorSvgUri from "../../../src/demos/drawing/org.gtk.gtk4.NodeEditor.Devel.svg";
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

    it("packs the open button into a HeaderBar titlebar", async () => {
        await renderDemo(paintableSvgDemo);
        const headerBar = (await screen.findByName("paintable-svg-header")) as Gtk.HeaderBar;
        expect(headerBar).toBeInstanceOf(Gtk.HeaderBar);
        const openButton = within(headerBar).getByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" }) as Gtk.Button;
        expect(openButton).toBeInstanceOf(Gtk.Button);
        expect(openButton.getUseUnderline()).toBe(true);
    });

    it("loads the bundled SVG and attaches it to the picture", async () => {
        await renderDemo(paintableSvgDemo);
        const picture = (await screen.findByName("picture")) as Gtk.Picture;
        await waitFor(() => expect(picture.getPaintable()).toBeInstanceOf(Gtk.Svg));
    });
});

describe("paintableSvgDemo open dialog", () => {
    it("invokes the file picker and replaces the picture's paintable when a new file is chosen", async () => {
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open");
        openSpy.mockResolvedValue(Gio.fileNewForUri(nodeEditorSvgUri));
        try {
            await renderDemo(paintableSvgDemo);
            const picture = (await screen.findByName("picture")) as Gtk.Picture;
            await waitFor(() => expect(picture.getPaintable()).toBeInstanceOf(Gtk.Svg));
            const initial = picture.getPaintable();
            const openButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;
            await userEvent.click(openButton);
            await waitFor(() => expect(openSpy).toHaveBeenCalled());
            await waitFor(() => expect(picture.getPaintable()).not.toBe(initial));
        } finally {
            openSpy.mockRestore();
        }
    });

    it("logs an error and leaves the picture unchanged when the file picker is dismissed", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open");
        openSpy.mockRejectedValue(new Error("dismissed"));
        try {
            await renderDemo(paintableSvgDemo);
            const picture = (await screen.findByName("picture")) as Gtk.Picture;
            await waitFor(() => expect(picture.getPaintable()).toBeInstanceOf(Gtk.Svg));
            const initial = picture.getPaintable();
            const openButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;
            await userEvent.click(openButton);
            await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("dismissed"));
            expect(picture.getPaintable()).toBe(initial);
        } finally {
            openSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });
});

describe("paintableSvgDemo gesture", () => {
    it("cycles the SVG state when the picture is pressed", async () => {
        await renderDemo(paintableSvgDemo);
        const picture = (await screen.findByName("picture")) as Gtk.Picture;
        await waitFor(() => expect(picture.getPaintable()).toBeInstanceOf(Gtk.Svg));
        const svg = picture.getPaintable() as Gtk.Svg;
        const initialState = svg.getState();
        await userEvent.pointer(picture, "[MouseLeft]");
        await waitFor(() => expect(svg.getState()).not.toBe(initialState));
    });

    it("wraps the SVG state from 63 back to 0 when the picture is pressed at the upper bound", async () => {
        await renderDemo(paintableSvgDemo);
        const picture = (await screen.findByName("picture")) as Gtk.Picture;
        await waitFor(() => expect(picture.getPaintable()).toBeInstanceOf(Gtk.Svg));
        const svg = picture.getPaintable() as Gtk.Svg;
        svg.setState(63);
        await userEvent.pointer(picture, "[MouseLeft]");
        await waitFor(() => expect(svg.getState()).toBe(0));
    });
});
