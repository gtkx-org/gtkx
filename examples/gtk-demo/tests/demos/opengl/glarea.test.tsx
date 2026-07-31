import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { glareaDemo } from "../../../src/demos/opengl/glarea.js";
import { renderDemo } from "../../test-utils.js";

describe("glareaDemo", () => {
    it("exposes the expected metadata", () => {
        expect(glareaDemo.id).toBe("glarea");
        expect(glareaDemo.title).toBe("OpenGL/OpenGL Area");
        expect(glareaDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(glareaDemo.keywords)).toBe(true);
        expect(typeof glareaDemo.sourceCode).toBe("string");
        expect(glareaDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(glareaDemo.component).toBeTypeOf("function");
    });

    it("renders a GtkGLArea with the configured size hints", async () => {
        await renderDemo(glareaDemo);
        const glArea = await screen.findByName("gl-area", { as: Gtk.GLArea });
        const [width, height] = glArea.getSizeRequest();
        expect(width).toBe(100);
        expect(height).toBe(200);
    });

    it("renders three axis sliders and an enabled Quit button", async () => {
        await renderDemo(glareaDemo);

        const scales = await screen.findAllByRole(Gtk.AccessibleRole.SLIDER, {
            value: { min: 0, max: 360 },
            as: Gtk.Scale,
        });

        expect(scales).toHaveLength(3);

        for (const scale of scales) {
            expect(scale.getAdjustment()).toHaveObjectProperty("stepIncrement", 1);
            expect(scale).toHaveObjectProperty("drawValue", false);
        }

        const quit = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Quit", as: Gtk.Button });
        expect(quit).toBeEnabled();
    });
});

describe("glareaDemo interaction", () => {
    it("queues a re-render of the GL area when each axis slider's value changes", async () => {
        await renderDemo(glareaDemo);
        const glArea = await screen.findByName("gl-area", { as: Gtk.GLArea });
        const queueRenderSpy = vi.spyOn(glArea, "queueRender");
        const scales = await screen.findAllByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });

        for (const scale of scales) {
            scale.grabFocus();
            await userEvent.keyboard(scale, "{PageUp}");

            await waitFor(() => {
                expect(scale).toHaveValue(12);
            });
        }

        expect(queueRenderSpy).toHaveBeenCalledTimes(3);
        queueRenderSpy.mockRestore();
    });

    it("destroys the host window when the Quit button is clicked", async () => {
        await renderDemo(glareaDemo);
        await screen.findByRole(Gtk.AccessibleRole.WINDOW);
        const quit = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Quit", as: Gtk.Button });
        await userEvent.click(quit);

        await waitFor(() => {
            expect(screen.queryByRole(Gtk.AccessibleRole.WINDOW)).toBeNull();
        });
    });

    it("labels the axis sliders with X / Y / Z legends", async () => {
        await renderDemo(glareaDemo);
        await screen.findByText("X axis");
        await screen.findByText("Y axis");
        await screen.findByText("Z axis");
        const sliders = await screen.findAllByRole(Gtk.AccessibleRole.SLIDER);
        expect(sliders).toHaveLength(3);
    });
});
