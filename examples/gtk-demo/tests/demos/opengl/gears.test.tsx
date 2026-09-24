import * as Gtk from "@gtkx/gi/gtk";
import { screen, screenshot, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { gearsDemo } from "../../../src/demos/opengl/gears.js";
import { renderDemo, screenshotColors } from "../../test-utils.js";

describe("gearsDemo", () => {
    it("exposes named controls for all three axes", async () => {
        await renderDemo(gearsDemo);

        for (const [name, value] of [
            ["X axis", 20],
            ["Y axis", 30],
            ["Z axis", 20],
        ] as const) {
            expect(await screen.findByRole(Gtk.AccessibleRole.SLIDER, { name, as: Gtk.Scale })).toHaveValue(value);
        }
    });

    it("paints visible shaded gears in the GL area", async () => {
        await renderDemo(gearsDemo);
        const glArea = await screen.findByName("gl-area", { as: Gtk.GLArea });
        const image = await screenshot(glArea);
        expect(screenshotColors(image).size).toBeGreaterThan(8);
    });
});

describe("gearsDemo axis sliders", () => {
    it("rotates the rendered gears when an axis changes", async () => {
        await renderDemo(gearsDemo);
        const glArea = await screen.findByName("gl-area", { as: Gtk.GLArea });
        const xSlider = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { name: "X axis", as: Gtk.Scale });
        const before = await screenshot(glArea);
        xSlider.grabFocus();
        await userEvent.keyboard(xSlider, "{PageUp}");

        await waitFor(async () => {
            expect(xSlider).toHaveValue(32);
            const after = await screenshot(glArea);
            expect(after.data).not.toBe(before.data);
        });
    });
});
