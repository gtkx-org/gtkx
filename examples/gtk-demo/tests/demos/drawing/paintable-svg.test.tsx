import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import animatedGpaPath from "../../../data/demos/drawing/animated.gpa?resource";
import { paintableSvgDemo } from "../../../src/demos/drawing/paintable-svg.js";
import { findButton, renderDemo } from "../../test-utils.js";

const renderAndFindPicture = async (isReactStrictMode = false): Promise<Gtk.Picture> => {
    await renderDemo(paintableSvgDemo, { isReactStrictMode });

    return screen.findByName("picture", { as: Gtk.Picture });
};

const renderAndFindSvgPicture = async (isReactStrictMode = false): Promise<{ picture: Gtk.Picture; svg: Gtk.Svg }> => {
    const picture = await renderAndFindPicture(isReactStrictMode);

    await waitFor(() => {
        expect(picture.getPaintable()).toBeInstanceOf(Gtk.Svg);
    });

    return { picture, svg: picture.getPaintable() as Gtk.Svg };
};

const openPictureFileDialog = async (isReactStrictMode = false): Promise<Gtk.Picture> => {
    const { picture } = await renderAndFindSvgPicture(isReactStrictMode);
    const openButton = await findButton("Open");
    await userEvent.click(openButton);

    return picture;
};

describe("paintableSvgDemo rendering", () => {
    it("renders the Open button in the header bar", async () => {
        await renderDemo(paintableSvgDemo);
        const openButton = await findButton("Open");
        expect(openButton).toHaveObjectProperty("label", "_Open");
        expect(openButton).toHaveObjectProperty("useUnderline", true);
    });

    it("renders a GtkPicture displaying the SVG paintable", async () => {
        const { picture } = await renderAndFindSvgPicture();
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
        const { svg } = await renderAndFindSvgPicture();
        expect(svg.getIntrinsicWidth()).toBe(128);
        expect(svg.getIntrinsicHeight()).toBe(128);
    });
});

describe("paintableSvgDemo open dialog", () => {
    it("invokes the file picker and replaces the picture's paintable when a new file is chosen", async () => {
        const openSpy = vi
            .spyOn(Gtk.FileDialog.prototype, "open")
            .mockImplementation((_window, cancellable) =>
                cancellable?.isCancelled() === false
                    ? Promise.resolve(Gio.File.newForUri(`resource://${animatedGpaPath}`))
                    : Promise.reject(new Error("cancelled")));

        try {
            const picture = await openPictureFileDialog(true);

            await waitFor(() => {
                expect(picture.getPaintable()?.getIntrinsicWidth()).toBe(64);
                expect(picture.getPaintable()?.getIntrinsicHeight()).toBe(64);
            });
        } finally {
            openSpy.mockRestore();
        }
    });

    it("leaves the picture unchanged when the file picker is dismissed", async () => {
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open");
        openSpy.mockRejectedValue(new Error("dismissed"));

        try {
            const picture = await openPictureFileDialog();
            expect(picture.getPaintable()?.getIntrinsicWidth()).toBe(128);
            expect(picture.getPaintable()?.getIntrinsicHeight()).toBe(128);
        } finally {
            openSpy.mockRestore();
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
