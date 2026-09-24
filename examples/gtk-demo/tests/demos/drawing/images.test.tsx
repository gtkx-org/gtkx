import * as Gtk from "@gtkx/gi/gtk";
import { screen, screenshot, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { imagesDemo } from "../../../src/demos/drawing/images.js";
import { renderDemo } from "../../test-utils.js";

const TRANSITION_TIMEOUT = 4000;

const findStatefulImage = (): Promise<Gtk.Image> => screen.findByName("stateful-icon-image", { as: Gtk.Image });

describe("imagesDemo metadata", () => {
    it("renders the section headings for every image panel", async () => {
        await renderDemo(imagesDemo);

        const headings = [
            "Image from a resource",
            "Animation from a resource",
            "Symbolic themed icon",
            "Stateful icon",
            "Path animation",
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

        const toggle = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Insensitive",
            as: Gtk.ToggleButton,
        });

        expect(toggle).not.toBePressed();
    });

    it("toggles the sensitivity of the image strip when the toggle is activated", async () => {
        await renderDemo(imagesDemo);

        const toggle = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Insensitive",
            as: Gtk.ToggleButton,
        });

        const imageStrip = await screen.findByName("image-strip", { as: Gtk.Box });
        expect(imageStrip).toBeEnabled();
        await userEvent.click(toggle);

        await waitFor(() => {
            expect(imageStrip).toBeDisabled();
        });

        await userEvent.click(toggle);

        await waitFor(() => {
            expect(imageStrip).toBeEnabled();
        });
    });
});

describe("imagesDemo stateful icon switch", () => {
    it("repaints the checkmark as a cross and restores it when switched back", async () => {
        await renderDemo(imagesDemo);
        const image = await findStatefulImage();
        const toggle = await screen.findByRole(Gtk.AccessibleRole.SWITCH, {
            name: "Stateful icon state",
            as: Gtk.Switch,
        });
        const checkmark = await screenshot(image);
        expect(image).toHaveAccessibleName("Checkmark");
        expect(toggle).not.toBeChecked();
        await userEvent.click(toggle);

        await waitFor(
            async () => {
                expect(toggle).toBeChecked();
                expect(image).toHaveAccessibleName("Cross");
                const painted = await screenshot(image);
                expect(painted.data).not.toBe(checkmark.data);
            },
            { timeout: TRANSITION_TIMEOUT },
        );

        await userEvent.click(toggle);

        await waitFor(
            async () => {
                expect(toggle).not.toBeChecked();
                expect(image).toHaveAccessibleName("Checkmark");
                const painted = await screenshot(image);
                expect(painted.data).toBe(checkmark.data);
            },
            { timeout: TRANSITION_TIMEOUT },
        );
    });
});

describe("imagesDemo animation", () => {
    it("plays the path animation while it is visible", async () => {
        await renderDemo(imagesDemo, { areAnimationsEnabled: true });
        const image = await screen.findByName("path-animation-image", { as: Gtk.Image });
        const firstFrame = await screenshot(image);

        await waitFor(
            async () => {
                const nextFrame = await screenshot(image);
                expect(nextFrame.data).not.toBe(firstFrame.data);
            },
            { timeout: TRANSITION_TIMEOUT },
        );
    });
});

describe("imagesDemo media widgets", () => {
    it("loads the resource animation as the picture's looping paintable", async () => {
        await renderDemo(imagesDemo, { isReactStrictMode: true });
        const picture = await screen.findByName("animation-picture", { as: Gtk.Picture });

        await waitFor(() => {
            const paintable = picture.getPaintable() as Gtk.MediaFile;
            expect(paintable).toBeInstanceOf(Gtk.MediaFile);
            expect(paintable.prepared).toBe(true);
            expect(paintable.getError()).toBeNull();
            expect(paintable.getLoop()).toBe(true);
            expect(paintable.getIntrinsicWidth()).toBe(80);
            expect(paintable.getIntrinsicHeight()).toBe(70);
        });
    });

    it("renders a GtkVideo widget configured to autoplay and loop", async () => {
        await renderDemo(imagesDemo);
        const picture = await screen.findByName("animation-picture", { as: Gtk.Picture });
        const video = await screen.findByName("animation-video", { as: Gtk.Video });
        expect(video).toHaveObjectProperty("autoplay", true);
        expect(video).toHaveObjectProperty("loop", true);

        await waitFor(() => {
            expect(video.getMediaStream()).toBe(picture.getPaintable());
        });
    });

    it("creates the widget paintable for the host window after mount", async () => {
        await renderDemo(imagesDemo);
        const picture = await screen.findByName("widget-paintable-picture", { as: Gtk.Picture });

        await waitFor(() => {
            expect(picture.getPaintable()).not.toBeNull();
        });
    });
});
