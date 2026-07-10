import * as Gtk from "@gtkx/gi/gtk";
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
            expect(await screen.findByText(heading)).toHaveTextContent(heading);
        }
    });
});

describe("imagesDemo toggle", () => {
    it("renders the Insensitive toggle button in its default off state", async () => {
        await renderDemo(imagesDemo);
        const toggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "_Insensitive",
        })) as Gtk.ToggleButton;
        expect(toggle).not.toBePressed();
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

describe("imagesDemo stateful icon switch", () => {
    it("drives the SVG paintable between its two states as the switch is flipped", async () => {
        await renderDemo(imagesDemo);
        const image = (await screen.findByName("stateful-icon-image")) as Gtk.Image;
        const svg = image.getPaintable() as Gtk.Svg;
        expect(svg).toBeInstanceOf(Gtk.Svg);
        expect(svg.getState()).toBe(0);

        const toggle = (await screen.findByRole(Gtk.AccessibleRole.SWITCH)) as Gtk.Switch;
        expect(toggle).not.toBeChecked();

        await userEvent.click(toggle);
        await waitFor(() => expect(toggle).toBeChecked());
        expect(svg.getState()).toBe(1);

        await userEvent.click(toggle);
        await waitFor(() => expect(toggle).not.toBeChecked());
        expect(svg.getState()).toBe(0);
    });
});

describe("imagesDemo media widgets", () => {
    it("loads the animated GIF as the gif picture's paintable after mount", async () => {
        await renderDemo(imagesDemo);
        const gif = (await screen.findByName("gif-picture")) as Gtk.Picture;
        await waitFor(() => expect(gif.getPaintable()).not.toBeNull());
    });

    it("renders a GtkVideo widget configured to autoplay and loop", async () => {
        await renderDemo(imagesDemo);
        const video = (await screen.findByName("logo-video")) as Gtk.Video;
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
