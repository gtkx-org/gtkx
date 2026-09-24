import * as Gtk from "@gtkx/gi/gtk";
import { screen, screenshot, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { glareaDemo } from "../../../src/demos/opengl/glarea.js";
import { renderDemo, screenshotColors } from "../../test-utils.js";

describe("glareaDemo", () => {
    it("paints a colored triangle", async () => {
        await renderDemo(glareaDemo);
        const glArea = await screen.findByName("gl-area", { as: Gtk.GLArea });
        expect(screenshotColors(await screenshot(glArea)).size).toBeGreaterThan(8);
    });

    it("exposes named controls for all three axes and closing the demo", async () => {
        await renderDemo(glareaDemo);

        for (const name of ["X axis", "Y axis", "Z axis"]) {
            expect(await screen.findByRole(Gtk.AccessibleRole.SLIDER, { name, as: Gtk.Scale })).toHaveValue(0);
        }

        const quit = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Quit", as: Gtk.Button });
        expect(quit).toBeEnabled();
    });
});

describe("glareaDemo interaction", () => {
    it("updates the rendered frame when the axis sliders change", async () => {
        await renderDemo(glareaDemo);
        const glArea = await screen.findByName("gl-area", { as: Gtk.GLArea });
        const before = await screenshot(glArea);
        const scales = await Promise.all(
            ["X axis", "Y axis", "Z axis"].map((name) =>
                screen.findByRole(Gtk.AccessibleRole.SLIDER, { name, as: Gtk.Scale }),
            ),
        );

        for (const scale of scales) {
            scale.grabFocus();
            await userEvent.keyboard(scale, "{PageUp}");

            await waitFor(() => {
                expect(scale).toHaveValue(12);
            });
        }

        const after = await screenshot(glArea);
        expect(after.data).not.toBe(before.data);
    });

    it("closes through the demo host when the Quit button is clicked", async () => {
        let completions = 0;
        await renderDemo(glareaDemo, { onClose: () => {
            completions += 1;
        } });
        await screen.findByRole(Gtk.AccessibleRole.WINDOW);
        const quit = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Quit", as: Gtk.Button });
        await userEvent.click(quit);

        await waitFor(() => {
            expect(screen.queryByRole(Gtk.AccessibleRole.WINDOW)).toBeNull();
            expect(completions).toBe(1);
        });
    });
});
