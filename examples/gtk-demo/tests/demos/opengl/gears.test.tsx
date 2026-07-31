import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { gearsDemo } from "../../../src/demos/opengl/gears.js";
import { renderDemo } from "../../test-utils.js";

describe("gearsDemo", () => {
    it("exposes the expected metadata", () => {
        expect(gearsDemo.id).toBe("gears");
        expect(gearsDemo.title).toBe("OpenGL/Gears");
        expect(gearsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(gearsDemo.keywords)).toBe(true);
        expect(typeof gearsDemo.sourceCode).toBe("string");
        expect(gearsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(gearsDemo.component).toBeTypeOf("function");
        expect(gearsDemo.defaultWidth).toBe(640);
        expect(gearsDemo.defaultHeight).toBe(640);
    });

    it("renders a GtkGLArea configured with an ES context and a depth buffer", async () => {
        await renderDemo(gearsDemo);
        const glArea = await screen.findByName("gl-area", { as: Gtk.GLArea });
        expect(glArea).toHaveObjectProperty("useEs", true);
        expect(glArea).toHaveObjectProperty("hasDepthBuffer", true);
    });

    it("renders one vertical inverted axis slider for each of X, Y, Z", async () => {
        await renderDemo(gearsDemo);

        for (const axis of ["X", "Y", "Z"]) {
            await screen.findByRole(Gtk.AccessibleRole.LABEL, { name: axis });
        }

        const sliders = await screen.findAllByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
        expect(sliders).toHaveLength(3);

        for (const slider of sliders) {
            expect(slider).toHaveObjectProperty("orientation", Gtk.Orientation.VERTICAL);
            expect(slider).toHaveObjectProperty("inverted", true);
            expect(slider.getAdjustment()).toHaveObjectProperty("lower", 0);
            expect(slider.getAdjustment()).toHaveObjectProperty("upper", 360);
        }
    });
});

describe("gearsDemo axis sliders", () => {
    it("seeds each axis slider with its own distinct initial rotation value", async () => {
        await renderDemo(gearsDemo);
        const sliders = await screen.findAllByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
        const [xSlider, ySlider, zSlider] = [sliders[0] as Gtk.Scale, sliders[1] as Gtk.Scale, sliders[2] as Gtk.Scale];
        expect(xSlider).toHaveValue(20);
        expect(ySlider).toHaveValue(30);
        expect(zSlider).toHaveValue(20);
    });

    it("advances each axis slider one page increment on PageUp", async () => {
        await renderDemo(gearsDemo);
        const sliders = await screen.findAllByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
        const xSlider = sliders[0] as Gtk.Scale;
        const ySlider = sliders[1] as Gtk.Scale;
        const zSlider = sliders[2] as Gtk.Scale;
        xSlider.grabFocus();
        await userEvent.keyboard(xSlider, "{PageUp}");

        await waitFor(() => {
            expect(xSlider).toHaveValue(32);
        });

        ySlider.grabFocus();
        await userEvent.keyboard(ySlider, "{PageUp}");

        await waitFor(() => {
            expect(ySlider).toHaveValue(42);
        });

        zSlider.grabFocus();
        await userEvent.keyboard(zSlider, "{PageUp}");

        await waitFor(() => {
            expect(zSlider).toHaveValue(32);
        });
    });

    it("shows the placeholder FPS readout before any frame timing is sampled", async () => {
        await renderDemo(gearsDemo);
        const fps = await screen.findByText("FPS: ---");
        expect(fps).toHaveTextContent("FPS: ---");
    });
});
