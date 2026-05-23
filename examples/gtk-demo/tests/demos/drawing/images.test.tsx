import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { imagesDemo } from "../../../src/demos/drawing/images.js";
import { act, fireEvent, renderDemo, screen, waitFor } from "../../test-utils.js";

const walkWidgetTree = function* (root: Gtk.Widget): Generator<Gtk.Widget> {
    yield root;
    let child = root.getFirstChild();
    while (child) {
        yield* walkWidgetTree(child);
        child = child.getNextSibling();
    }
};

const findAllPictures = (root: Gtk.Widget): Gtk.Picture[] => {
    const out: Gtk.Picture[] = [];
    for (const widget of walkWidgetTree(root)) {
        if (widget instanceof Gtk.Picture) out.push(widget);
    }
    return out;
};

const findAllVideos = (root: Gtk.Widget): Gtk.Video[] => {
    const out: Gtk.Video[] = [];
    for (const widget of walkWidgetTree(root)) {
        if (widget instanceof Gtk.Video) out.push(widget);
    }
    return out;
};

const findInsensitiveToggle = async (): Promise<Gtk.ToggleButton> =>
    (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "_Insensitive" })) as Gtk.ToggleButton;

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
            expect(await screen.findByText(new RegExp(heading.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&")))).toBeDefined();
        }
    });
});

describe("imagesDemo toggle", () => {
    it("renders the Insensitive toggle button in its default off state", async () => {
        await renderDemo(imagesDemo);
        const toggle = await findInsensitiveToggle();
        expect(toggle.getActive()).toBe(false);
        expect(toggle.getUseUnderline()).toBe(true);
        expect(toggle.getLabel()).toBe("_Insensitive");
    });

    it("toggles the sensitivity of the image strip when the toggle is activated", async () => {
        await renderDemo(imagesDemo);
        const toggle = await findInsensitiveToggle();
        const imageStrip = (await screen.findByName("image-strip")) as Gtk.Box;
        expect(imageStrip.getSensitive()).toBe(true);
        await act(() => toggle.setActive(true));
        await fireEvent(toggle, "toggled");
        expect(imageStrip.getSensitive()).toBe(false);
        await act(() => toggle.setActive(false));
        await fireEvent(toggle, "toggled");
        expect(imageStrip.getSensitive()).toBe(true);
    });
});

describe("imagesDemo media widgets", () => {
    it("renders multiple GtkPicture widgets including the floppybuddy gif and widget paintable", async () => {
        const { container } = await renderDemo(imagesDemo);
        const pictures = findAllPictures(container);
        expect(pictures.length).toBeGreaterThanOrEqual(2);
    });

    it("renders a GtkVideo widget that autoplays and loops", async () => {
        const { container } = await renderDemo(imagesDemo);
        const videos = findAllVideos(container);
        expect(videos.length).toBeGreaterThanOrEqual(1);
        const video = videos[0];
        if (!video) return;
        expect(video.getAutoplay()).toBe(true);
        expect(video.getLoop()).toBe(true);
    });

    it("creates the widget paintable for the host window after mount", async () => {
        const { container } = await renderDemo(imagesDemo);
        await waitFor(() => {
            const pictures = findAllPictures(container);
            const paintablePic = pictures.find((p) => p.getPaintable() !== null);
            if (!paintablePic) throw new Error("expected at least one picture with a paintable");
        });
    });
});
