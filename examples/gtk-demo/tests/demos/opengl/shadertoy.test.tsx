import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { shadertoyDemo } from "../../../src/demos/opengl/shadertoy.js";
import { renderDemo } from "../../test-utils.js";

const PRESET_NAMES = ["Alien Planet", "Mandelbrot", "Neon", "Cogs", "Glowing Stars"];

const clickPreset = async (name: string): Promise<void> => {
    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.Button });
    await userEvent.click(button);
};

vi.setConfig({ testTimeout: 30_000 });

describe("shadertoyDemo", () => {
    it("exposes the expected metadata", () => {
        expect(shadertoyDemo.id).toBe("shadertoy");
        expect(shadertoyDemo.title).toBe("OpenGL/Shadertoy");
        expect(shadertoyDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(shadertoyDemo.keywords)).toBe(true);
        expect(typeof shadertoyDemo.sourceCode).toBe("string");
        expect(shadertoyDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(shadertoyDemo.component).toBeTypeOf("function");
    });

    it("renders the main GtkGLArea panel configured with an ES context", async () => {
        await renderDemo(shadertoyDemo);
        const glArea = await screen.findByName("shadertoy-gl-area", { as: Gtk.GLArea });

        await waitFor(() => {
            expect(glArea.getAllocatedWidth()).toBeGreaterThan(0);
        });

        expect(glArea).toHaveObjectProperty("useEs", true);
    });

    it("seeds the source editor with the Alien Planet fragment shader", async () => {
        await renderDemo(shadertoyDemo);
        const sourceView = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        expect(await screen.findByDisplayValue(/MAX_DISTANCE/)).toBe(sourceView);
        expect(sourceView).toHaveDisplayValue(/mountainColor/);
        expect(sourceView).toHaveDisplayValue(/void mainImage/);
    });
});

describe("shadertoyDemo shader presets", () => {
    it("exposes Restart, Clear, and one button per shader preset", async () => {
        await renderDemo(shadertoyDemo);

        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Restart the demo" })).toBeInstanceOf(
            Gtk.Button,
        );

        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Clear the text view" })).toBeInstanceOf(
            Gtk.Button,
        );

        for (const presetName of PRESET_NAMES) {
            expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: presetName })).toBeInstanceOf(Gtk.Button);
        }
    });
});

describe("shadertoyDemo editor", () => {
    it("clears the editor buffer when the Clear button is activated", async () => {
        await renderDemo(shadertoyDemo);
        expect(await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveDisplayValue(/void mainImage/);

        const clear = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Clear the text view",
            as: Gtk.Button,
        });

        await userEvent.click(clear);

        await waitFor(() => {
            expect(screen.queryByDisplayValue(/.+/)).toBeNull();
        });
    });

    it("loads each preset shader into the buffer when its button is activated", async () => {
        await renderDemo(shadertoyDemo);
        await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await screen.findByDisplayValue(/MAX_DISTANCE/);
        await clickPreset("Mandelbrot");
        await screen.findByDisplayValue(/MANDELBROT_ITER/);
        expect(screen.queryByDisplayValue(/MAX_DISTANCE/)).toBeNull();
        await clickPreset("Neon");
        await screen.findByDisplayValue(/sunEffect/);
        expect(screen.queryByDisplayValue(/MANDELBROT_ITER/)).toBeNull();
        await clickPreset("Cogs");
        await screen.findByDisplayValue(/cogwheel/);
        expect(screen.queryByDisplayValue(/sunEffect/)).toBeNull();
        await clickPreset("Glowing Stars");
        await screen.findByDisplayValue(/planeCol/);
        expect(screen.queryByDisplayValue(/cogwheel/)).toBeNull();
        await clickPreset("Alien Planet");
        await screen.findByDisplayValue(/MAX_DISTANCE/);
        expect(screen.queryByDisplayValue(/planeCol/)).toBeNull();
    });

    it("propagates user edits to the buffer", async () => {
        await renderDemo(shadertoyDemo);
        const sourceView = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
        await userEvent.clear(sourceView);
        await userEvent.type(sourceView, "// custom shader");
        expect(await screen.findByDisplayValue("// custom shader")).toBe(sourceView);
    });
});
