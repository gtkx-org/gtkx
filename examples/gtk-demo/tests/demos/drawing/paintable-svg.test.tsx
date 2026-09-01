import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import nodeEditorSvgPath from "../../../data/demos/drawing/org.gtk.gtk4.NodeEditor.Devel.svg?resource";
import { paintableSvgDemo } from "../../../src/demos/drawing/paintable-svg.js";
import { findButton, renderDemo } from "../../test-utils.js";

type PictureState = { picture: Gtk.Picture; initial: ReturnType<Gtk.Picture["getPaintable"]> };

const renderAndFindPicture = async (): Promise<Gtk.Picture> => {
    await renderDemo(paintableSvgDemo);

    return screen.findByName("picture", { as: Gtk.Picture });
};

const renderAndFindSvgPicture = async (): Promise<{ picture: Gtk.Picture; svg: Gtk.Svg }> => {
    const picture = await renderAndFindPicture();

    await waitFor(() => {
        expect(picture.getPaintable()).toBeInstanceOf(Gtk.Svg);
    });

    return { picture, svg: picture.getPaintable() as Gtk.Svg };
};

const openPictureFileDialog = async (): Promise<PictureState> => {
    const { picture } = await renderAndFindSvgPicture();
    const initial = picture.getPaintable();
    const openButton = await findButton("Open");
    await userEvent.click(openButton);

    return { picture, initial };
};

describe("paintableSvgDemo rendering", () => {
    it("renders the Open button in the header bar", async () => {
        await renderDemo(paintableSvgDemo);
        const openButton = await findButton("Open");
        expect(openButton).toHaveObjectProperty("label", "_Open");
        expect(openButton).toHaveObjectProperty("useUnderline", true);
    });

    it("renders a GtkPicture displaying the SVG paintable", async () => {
        const { picture, svg } = await renderAndFindSvgPicture();
        expect(picture).toHaveObjectProperty("paintable", svg);
        expect(picture).toBeRooted();
    });

    it("packs the open button into a HeaderBar titlebar", async () => {
        await renderDemo(paintableSvgDemo);
        const headerBar = await screen.findByName("paintable-svg-header", { as: Gtk.HeaderBar });
        const openButton = within(headerBar).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Open", as: Gtk.Button });
        expect(headerBar).toContainElement(openButton);
        expect(openButton).toBe(await findButton("Open"));
    });

    it("loads the bundled SVG and attaches it to the picture", async () => {
        const { picture, svg } = await renderAndFindSvgPicture();
        expect(picture).toHaveObjectProperty("paintable", svg);
        expect(svg.getIntrinsicWidth()).toBe(128);
        expect(svg.getIntrinsicHeight()).toBe(128);
    });
});

describe("paintableSvgDemo open dialog", () => {
    it("invokes the file picker and replaces the picture's paintable when a new file is chosen", async () => {
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open");
        openSpy.mockResolvedValue(Gio.File.newForUri(`resource://${nodeEditorSvgPath}`));

        try {
            const { picture, initial } = await openPictureFileDialog();

            await waitFor(() => {
                expect(openSpy).toHaveBeenCalled();
            });

            await waitFor(() => {
                expect(picture).not.toHaveObjectProperty("paintable", initial);
            });
        } finally {
            openSpy.mockRestore();
        }
    });

    it("logs an error and leaves the picture unchanged when the file picker is dismissed", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation((): void => undefined);
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open");
        openSpy.mockRejectedValue(new Error("dismissed"));

        try {
            const { picture, initial } = await openPictureFileDialog();

            await waitFor(() => {
                expect(errorSpy).toHaveBeenCalledWith("dismissed");
            });

            expect(picture).toHaveObjectProperty("paintable", initial);
        } finally {
            openSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });
});

describe("paintableSvgDemo gesture", () => {
    it("cycles the SVG state when the picture is pressed", async () => {
        const { picture, svg } = await renderAndFindSvgPicture();
        const initialState = svg.getState();
        await userEvent.pointer(picture, "[MouseLeft]");

        await waitFor(() => {
            expect(svg).not.toHaveObjectProperty("state", initialState);
        });
    });

    it("wraps the SVG state from 63 back to 0 when the picture is pressed at the upper bound", async () => {
        const { picture, svg } = await renderAndFindSvgPicture();
        svg.setState(63);
        await userEvent.pointer(picture, "[MouseLeft]");

        await waitFor(() => {
            expect(svg).toHaveObjectProperty("state", 0);
        });
    });
});
