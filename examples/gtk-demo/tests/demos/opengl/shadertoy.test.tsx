import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { shadertoyDemo } from "../../../src/demos/opengl/shadertoy.js";
import { findButton, renderDemo } from "../../test-utils.js";

const PRESET_NAMES = ["Alien Planet", "Mandelbrot", "Neon", "Cogs", "Glowing Stars"];

const clickPreset = async (name: string): Promise<void> => {
    await userEvent.click(await findButton(name));
};

const renderAndFindSourceView = async (): Promise<Gtk.TextView> => {
    await renderDemo(shadertoyDemo);

    return screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
};

vi.setConfig({ testTimeout: 30_000 });

describe("shadertoyDemo", () => {
    it("exposes the expected metadata", () => {
        expect(shadertoyDemo.id).toBe("shadertoy");
        expect(shadertoyDemo.title).toBe("OpenGL/Shadertoy");
        expect(shadertoyDemo.description).toContain("Generate pixels using a custom fragment shader.");
        expect(shadertoyDemo.keywords).toEqual(["GtkGLArea"]);
        expect(shadertoyDemo.sourceCode).toContain("const shadertoyDemo: Demo = {");
        expect(shadertoyDemo.component).toBeTypeOf("function");
    });

    it("renders the main GtkGLArea panel configured with an ES context", async () => {
        await renderDemo(shadertoyDemo);
        const glArea = await screen.findByName("shadertoy-gl-area", { as: Gtk.GLArea });

        await waitFor(() => {
            expect(glArea.getWidth()).toBeGreaterThan(0);
        });

        expect(glArea).toHaveObjectProperty("allowedApis", Gdk.GLAPI.GLES);
    });

    it("seeds the source editor with the Alien Planet fragment shader", async () => {
        const sourceView = await renderAndFindSourceView();
        expect(await screen.findByDisplayValue(/MAX_DISTANCE/)).toBe(sourceView);
        expect(sourceView).toHaveDisplayValue(/mountainColor/);
        expect(sourceView).toHaveDisplayValue(/void mainImage/);
    });
});

describe("shadertoyDemo shader presets", () => {
    it("exposes Restart, Clear, and one button per shader preset", async () => {
        await renderDemo(shadertoyDemo);
        expect(await findButton("Restart the demo")).toBeEnabled();
        expect(await findButton("Clear the text view")).toBeEnabled();

        for (const presetName of PRESET_NAMES) {
            expect(await findButton(presetName)).toBeEnabled();
        }
    });
});

describe("shadertoyDemo editor", () => {
    it("clears the editor buffer when the Clear button is activated", async () => {
        expect(await renderAndFindSourceView()).toHaveDisplayValue(/void mainImage/);
        await userEvent.click(await findButton("Clear the text view"));

        await waitFor(() => {
            expect(screen.queryByDisplayValue(/.+/)).toBeNull();
        });
    });

    it("loads each preset shader into the buffer when its button is activated", async () => {
        await renderAndFindSourceView();
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
        const sourceView = await renderAndFindSourceView();
        await userEvent.clear(sourceView);
        await userEvent.type(sourceView, "// custom shader");
        expect(await screen.findByDisplayValue("// custom shader")).toBe(sourceView);
    });
});
