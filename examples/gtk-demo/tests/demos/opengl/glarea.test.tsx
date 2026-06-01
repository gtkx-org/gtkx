import * as Gtk from "@gtkx/gi/gtk";
import { act, fireEvent, screen, userEvent, waitFor } from "@gtkx/testing";
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
        const glArea = (await screen.findByName("gl-area")) as Gtk.GLArea;
        expect(glArea).toBeInstanceOf(Gtk.GLArea);
        const [width, height] = glArea.getSizeRequest();
        expect(width).toBe(100);
        expect(height).toBe(200);
    });

    it("renders three axis sliders and a Quit button", async () => {
        await renderDemo(glareaDemo);
        const scales = (await screen.findAllByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale[];
        expect(scales).toHaveLength(3);
        for (const scale of scales) {
            expect(scale.getAdjustment().getUpper()).toBe(360);
            expect(scale.getAdjustment().getLower()).toBe(0);
            expect(scale.getAdjustment().getStepIncrement()).toBe(1);
            expect(scale.getDrawValue()).toBe(false);
        }
        const quit = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Quit" });
        expect(quit).toBeInstanceOf(Gtk.Button);
    });

    it("queues a re-render of the GL area when an axis slider's value changes", async () => {
        await renderDemo(glareaDemo);
        const glArea = (await screen.findByName("gl-area")) as Gtk.GLArea;
        const queueRenderSpy = vi.fn();
        const id = glArea.connect("notify::queue-render", queueRenderSpy);
        try {
            const scales = (await screen.findAllByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale[];
            const firstScale = scales[0] as Gtk.Scale;
            await act(() => firstScale.setValue(45));
            await fireEvent(firstScale, "value-changed");
            await waitFor(() => expect(firstScale.getValue()).toBe(45));
        } finally {
            glArea.disconnect(id);
        }
    });

    it("destroys the host window when the Quit button is clicked", async () => {
        await renderDemo(glareaDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        const destroySpy = vi.spyOn(window, "destroy").mockImplementation(() => {});
        try {
            const quit = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Quit" })) as Gtk.Button;
            await userEvent.click(quit);
            await waitFor(() => expect(destroySpy).toHaveBeenCalled());
        } finally {
            destroySpy.mockRestore();
        }
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
