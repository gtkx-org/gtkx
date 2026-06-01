import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, waitFor } from "@gtkx/testing";
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
        const glArea = (await screen.findByName("gl-area")) as Gtk.GLArea;
        expect(glArea).toBeInstanceOf(Gtk.GLArea);
        expect(glArea.getUseEs()).toBe(true);
        expect(glArea.getHasDepthBuffer()).toBe(true);
        expect(glArea.getHexpand()).toBe(true);
        expect(glArea.getVexpand()).toBe(true);
    });

    it("renders one vertical inverted axis slider for each of X, Y, Z", async () => {
        await renderDemo(gearsDemo);
        for (const axis of ["X", "Y", "Z"]) {
            expect(await screen.findByRole(Gtk.AccessibleRole.LABEL, { name: axis })).toBeInstanceOf(Gtk.Label);
        }
        const sliders = (await screen.findAllByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale[];
        expect(sliders).toHaveLength(3);
        for (const slider of sliders) {
            expect(slider.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
            expect(slider.getInverted()).toBe(true);
            expect(slider.getAdjustment().getLower()).toBe(0);
            expect(slider.getAdjustment().getUpper()).toBe(360);
        }
    });

    it("updates the X axis adjustment when the value changes", async () => {
        await renderDemo(gearsDemo);
        const sliders = (await screen.findAllByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale[];
        const xSlider = sliders[0] as Gtk.Scale;
        expect(xSlider.getValue()).toBe(20);
        await act(() => xSlider.getAdjustment().setValue(180));
        await waitFor(() => expect(xSlider.getValue()).toBe(180));
    });
});
