import type * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { imagesDemo } from "../../../src/demos/drawing/images.js";
import { renderDemo } from "../../test-utils.js";

const CHECKMARK_PATH = "M 10 35";
const CROSS_PATH = "M 5 35";
const TRANSITION_TIMEOUT = 4000;

const renderPaintable = (paintable: Gdk.Paintable): string => {
    const snapshot = Gtk.Snapshot.new();
    paintable.snapshot(snapshot, 128, 128);
    const node = snapshot.toNode();

    return node === null ? "" : String.fromCodePoint(...(node.serialize().getData() ?? []));
};

const findStatefulSvg = async (): Promise<Gtk.Svg> => {
    const image = await screen.findByName("stateful-icon-image", { as: Gtk.Image });

    return image.getPaintable() as Gtk.Svg;
};

describe("imagesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(imagesDemo.id).toBe("images");
        expect(imagesDemo.title).toBe("Images");

        expect(imagesDemo.description).toBe(
            "GtkImage and GtkPicture are used to display an image; the image can be in a number of formats.\n\n" +
            "GtkImage is the widget used to display icons or images that should be sized and styled like an " +
            "icon, while GtkPicture is used for images that should be displayed as-is.\n\n" +
            "This demo code shows some of the more obscure cases, in the simple case a call to " +
            "gtk_picture_new_for_file() or gtk_image_new_from_icon_name() is all you need.",
        );

        expect(imagesDemo.keywords).toEqual(["GdkPaintable", "GtkWidgetPaintable"]);
        expect(imagesDemo.sourceCode).toContain("const imagesDemo: Demo = {");
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
    it("drives the SVG paintable between its two states as the switch is flipped", async () => {
        await renderDemo(imagesDemo);
        const svg = await findStatefulSvg();
        expect(svg).toBeInstanceOf(Gtk.Svg);
        expect(svg).toHaveObjectProperty("state", 0);
        const toggle = await screen.findByRole(Gtk.AccessibleRole.SWITCH, { as: Gtk.Switch });
        expect(toggle).not.toBeChecked();
        await userEvent.click(toggle);

        await waitFor(() => {
            expect(toggle).toBeChecked();
        });

        expect(svg).toHaveObjectProperty("state", 1);
        await userEvent.click(toggle);

        await waitFor(() => {
            expect(toggle).not.toBeChecked();
        });

        expect(svg).toHaveObjectProperty("state", 0);
    });

    it("repaints the icon from the checkmark to the cross as the switch is flipped", async () => {
        await renderDemo(imagesDemo);
        const svg = await findStatefulSvg();
        expect(renderPaintable(svg)).toContain(CHECKMARK_PATH);
        const toggle = await screen.findByRole(Gtk.AccessibleRole.SWITCH, { as: Gtk.Switch });
        await userEvent.click(toggle);

        await waitFor(
            () => {
                const painted = renderPaintable(svg);
                expect(painted).toContain(CROSS_PATH);
                expect(painted).not.toContain(CHECKMARK_PATH);
            },
            { timeout: TRANSITION_TIMEOUT },
        );

        await userEvent.click(toggle);

        await waitFor(
            () => {
                const painted = renderPaintable(svg);
                expect(painted).toContain(CHECKMARK_PATH);
                expect(painted).not.toContain(CROSS_PATH);
            },
            { timeout: TRANSITION_TIMEOUT },
        );
    });
});

describe("imagesDemo media widgets", () => {
    it("loads the animated GIF as the gif picture's paintable after mount", async () => {
        await renderDemo(imagesDemo);
        const gif = await screen.findByName("gif-picture", { as: Gtk.Picture });

        await waitFor(() => {
            expect(gif.getPaintable()).not.toBeNull();
        });
    });

    it("renders a GtkVideo widget configured to autoplay and loop", async () => {
        await renderDemo(imagesDemo);
        const video = await screen.findByName("logo-video", { as: Gtk.Video });
        expect(video).toHaveObjectProperty("autoplay", true);
        expect(video).toHaveObjectProperty("loop", true);
    });

    it("creates the widget paintable for the host window after mount", async () => {
        await renderDemo(imagesDemo);
        const picture = await screen.findByName("widget-paintable-picture", { as: Gtk.Picture });

        await waitFor(() => {
            expect(picture.getPaintable()).not.toBeNull();
        });
    });
});
