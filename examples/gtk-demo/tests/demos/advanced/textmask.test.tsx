import { Context, Format, ImageSurface, Status } from "@gtkx/cairo";
import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { textmaskDemo } from "../../../src/demos/advanced/textmask.js";
import { renderDemo } from "../../test-utils.js";

type DrawFunc = (self: Gtk.DrawingArea, cr: Context, width: number, height: number) => void;

const captureDrawFunc = async (): Promise<{ drawingArea: Gtk.DrawingArea; drawFunc: DrawFunc }> => {
    const setDrawFunc = vi.spyOn(Gtk.DrawingArea.prototype, "setDrawFunc");

    try {
        await renderDemo(textmaskDemo);
        const drawingArea = await screen.findByName("textmask-area", { as: Gtk.DrawingArea });
        const call = setDrawFunc.mock.calls.find(([fn]) => typeof fn === "function");
        const drawFunc = call?.[0] as DrawFunc | undefined;

        if (!drawFunc) {
            throw new Error("textmask draw function was not registered");
        }

        return { drawingArea, drawFunc };
    } finally {
        setDrawFunc.mockRestore();
    }
};

describe("textmaskDemo metadata", () => {
    it("provides source code that references PangoCairo and a linear gradient", () => {
        const source = textmaskDemo.sourceCode ?? "";
        expect(source).toContain("PangoCairo");
        expect(source).toContain("createLinear");
    });
});

describe("textmaskDemo rendering", () => {
    it("applies the configured default size to the host window", async () => {
        await renderDemo(textmaskDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        const [width, height] = window.getDefaultSize();
        expect(width).toBe(400);
        expect(height).toBe(240);
    });

    it("mounts the GtkDrawingArea as the sole content of the host window", async () => {
        await renderDemo(textmaskDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        const drawingArea = await screen.findByName("textmask-area", { as: Gtk.DrawingArea });
        expect(drawingArea).toBeRooted();
        expect(window).toContainElement(drawingArea);
        expect(drawingArea).toBeEmptyWidget();
    });
});

describe("textmaskDemo paint", () => {
    it("paints the gradient-masked text onto a real Cairo surface", async () => {
        const { drawingArea, drawFunc } = await captureDrawFunc();
        const surface = ImageSurface.create(Format.ARGB32, 400, 240);
        const cr = Context.create(surface);
        drawFunc(drawingArea, cr, 400, 240);
        expect(cr.status()).toBe(Status.SUCCESS);
        expect(surface.getData().some((byte) => byte !== 0)).toBe(true);
        surface.finish();
    });

    it("lays out the three 'Pango power!' lines through PangoCairo during the paint", async () => {
        const { drawingArea, drawFunc } = await captureDrawFunc();
        const layoutTexts: string[] = [];
        const createLayout = vi.spyOn(Gtk.Widget.prototype, "createPangoLayout");

        try {
            const surface = ImageSurface.create(Format.ARGB32, 400, 240);
            const cr = Context.create(surface);
            drawFunc(drawingArea, cr, 400, 240);

            for (const call of createLayout.mock.results) {
                if (call.type !== "return") {
                    continue;
                }

                const layout = call.value;
                layoutTexts.push(layout.getText());
            }

            surface.finish();
        } finally {
            createLayout.mockRestore();
        }

        expect(layoutTexts).toContain("Pango power!\nPango power!\nPango power!");
    });
});
