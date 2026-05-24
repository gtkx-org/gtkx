import * as Gtk from "@gtkx/ffi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { imagesDemo } from "../../../src/demos/drawing/images.js";
import { renderDemo } from "../../test-utils.js";

describe("imagesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(imagesDemo.id).toBe("images");
        expect(imagesDemo.title).toBe("Images");
        expect(imagesDemo.description.length).toBeGreaterThan(0);
        expect(imagesDemo.keywords).toEqual(expect.arrayContaining(["GdkPaintable", "GtkWidgetPaintable"]));
        expect(typeof imagesDemo.sourceCode).toBe("string");
        expect(imagesDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(imagesDemo.component).toBeTypeOf("function");
    });

    it("renders the section headings for every image panel", async () => {
        await renderDemo(imagesDemo);
        const headings = [
            "Image from a resource",
            "Animation from a resource",
            "Symbolic themed icon",
            "Stateful icon",
            "Displaying video",
            "GtkWidgetPaintable",
        ];
        for (const heading of headings) {
            expect(await screen.findByText(heading)).toBeInstanceOf(Gtk.Widget);
        }
    });
});

describe("imagesDemo toggle", () => {
    it("renders the Insensitive toggle button in its default off state", async () => {
        await renderDemo(imagesDemo);
        const toggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "_Insensitive",
        })) as Gtk.ToggleButton;
        expect(toggle.getActive()).toBe(false);
        expect(toggle.getUseUnderline()).toBe(true);
        expect(toggle.getLabel()).toBe("_Insensitive");
    });

    it("toggles the sensitivity of the image strip when the toggle is activated", async () => {
        await renderDemo(imagesDemo);
        const toggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "_Insensitive",
        })) as Gtk.ToggleButton;
        const imageStrip = (await screen.findByName("image-strip")) as Gtk.Box;
        expect(imageStrip.getSensitive()).toBe(true);
        await userEvent.click(toggle);
        await waitFor(() => expect(imageStrip.getSensitive()).toBe(false));
        await userEvent.click(toggle);
        await waitFor(() => expect(imageStrip.getSensitive()).toBe(true));
    });
});

describe("imagesDemo media widgets", () => {
    it("renders the animation GtkPicture and the widget-paintable GtkPicture", async () => {
        await renderDemo(imagesDemo);
        expect(await screen.findByName("gif-picture")).toBeInstanceOf(Gtk.Picture);
        expect(await screen.findByName("widget-paintable-picture")).toBeInstanceOf(Gtk.Picture);
    });

    it("renders a GtkVideo widget that autoplays and loops", async () => {
        await renderDemo(imagesDemo);
        const video = (await screen.findByName("logo-video")) as Gtk.Video;
        expect(video).toBeInstanceOf(Gtk.Video);
        expect(video.getAutoplay()).toBe(true);
        expect(video.getLoop()).toBe(true);
    });

    it("creates the widget paintable for the host window after mount", async () => {
        await renderDemo(imagesDemo);
        const picture = (await screen.findByName("widget-paintable-picture")) as Gtk.Picture;
        await waitFor(() => {
            expect(picture.getPaintable()).not.toBeNull();
        });
    });
});
