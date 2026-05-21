import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { imagesDemo } from "../../../src/demos/drawing/images.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

describe("imagesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(imagesDemo.id).toBe("images");
        expect(imagesDemo.title).toBe("Images");
        expect(imagesDemo.description.length).toBeGreaterThan(0);
        expect(imagesDemo.keywords).toEqual(
            expect.arrayContaining(["GtkImage", "GtkPicture", "GtkVideo", "GdkPaintable"]),
        );
        expect(typeof imagesDemo.sourceCode).toBe("string");
        expect(imagesDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(imagesDemo.component).toBeTypeOf("function");
    });

    it("renders the section headings for every image panel", async () => {
        if (!imagesDemo.component) throw new Error("images demo component missing");
        const { container } = await renderDemo(imagesDemo.component);
        const labels = findAllOfType(container, Gtk.Label).map((l) => l.getLabel());
        expect(labels).toEqual(
            expect.arrayContaining(["Image", "Animation", "Symbolic icon", "Progressive", "Video", "Paintable"]),
        );
    });
});

describe("imagesDemo toggle", () => {
    it("renders the Insensitive toggle button in its default off state", async () => {
        if (!imagesDemo.component) throw new Error("images demo component missing");
        const { container } = await renderDemo(imagesDemo.component);
        const toggle = findInsensitiveToggle(container);
        expect(toggle).toBeInstanceOf(Gtk.ToggleButton);
        if (!toggle) return;
        expect(toggle.getActive()).toBe(false);
        expect(toggle.getUseUnderline()).toBe(true);
        expect(toggle.getLabel()).toBe("_Insensitive");
    });

    it("toggles the sensitivity of the image strip when the toggle is activated", async () => {
        if (!imagesDemo.component) throw new Error("images demo component missing");
        const { container } = await renderDemo(imagesDemo.component);
        const toggle = findInsensitiveToggle(container) as Gtk.ToggleButton;
        const boxes = findAllOfType(container, Gtk.Box);
        const imageStrip = boxes.find(
            (b) => b.getOrientation() === Gtk.Orientation.HORIZONTAL && b.getSpacing() === 16,
        );
        expect(imageStrip).toBeInstanceOf(Gtk.Box);
        if (!imageStrip) return;
        expect(imageStrip.getSensitive()).toBe(true);
        await act(() => toggle.setActive(true));
        await fireEvent(toggle as Gtk.Widget, "toggled");
        expect(imageStrip.getSensitive()).toBe(false);
        await act(() => toggle.setActive(false));
        await fireEvent(toggle as Gtk.Widget, "toggled");
        expect(imageStrip.getSensitive()).toBe(true);
    });
});

describe("imagesDemo media widgets", () => {
    it("renders multiple GtkPicture widgets including the progressive picture", async () => {
        if (!imagesDemo.component) throw new Error("images demo component missing");
        const { container } = await renderDemo(imagesDemo.component);
        const pictures = findAllOfType(container, Gtk.Picture);
        expect(pictures.length).toBeGreaterThanOrEqual(3);
        const progressive = pictures.find((p) => p.getAlternativeText() === "A slowly loading image");
        expect(progressive).toBeInstanceOf(Gtk.Picture);
    });

    it("renders a GtkVideo widget that autoplays and loops", async () => {
        if (!imagesDemo.component) throw new Error("images demo component missing");
        const { container } = await renderDemo(imagesDemo.component);
        const videos = findAllOfType(container, Gtk.Video);
        expect(videos.length).toBeGreaterThanOrEqual(1);
        const video = videos[0];
        if (!video) return;
        expect(video.getAutoplay()).toBe(true);
        expect(video.getLoop()).toBe(true);
    });

    it("creates the widget paintable for the host window after mount", async () => {
        if (!imagesDemo.component) throw new Error("images demo component missing");
        const { container } = await renderDemo(imagesDemo.component);
        await waitFor(() => {
            const pictures = findAllOfType(container, Gtk.Picture);
            const paintablePic = pictures.find((p) => p.getPaintable() !== null);
            if (!paintablePic) throw new Error("expected at least one picture with a paintable");
        });
    });
});

const findInsensitiveToggle = (root: Gtk.Widget): Gtk.ToggleButton | null =>
    findAllOfType(root, Gtk.ToggleButton).find((t) => t.getLabel() === "_Insensitive") ?? null;
