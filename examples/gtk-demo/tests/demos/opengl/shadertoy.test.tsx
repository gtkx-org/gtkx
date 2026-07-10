import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { shadertoyDemo } from "../../../src/demos/opengl/shadertoy.js";
import { renderDemo } from "../../test-utils.js";

vi.setConfig({ testTimeout: 30000 });

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
        const glArea = (await screen.findByName("shadertoy-gl-area")) as Gtk.GLArea;
        await waitFor(() => expect(glArea.getAllocatedWidth()).toBeGreaterThan(0));
        expect(glArea).toBeInstanceOf(Gtk.GLArea);
        expect(glArea.getUseEs()).toBe(true);
        expect(glArea.getHexpand()).toBe(true);
        expect(glArea.getVexpand()).toBe(true);
    });

    it("seeds the source editor with the Alien Planet fragment shader", async () => {
        await renderDemo(shadertoyDemo);
        const sourceView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        await screen.findByDisplayValue(/MAX_DISTANCE/);
        await screen.findByDisplayValue(/mountainColor/);
        await screen.findByDisplayValue(/void mainImage/);
        expect(sourceView.getMonospace()).toBe(true);
    });

    it("exposes Restart, Clear, and one button per shader preset", async () => {
        await renderDemo(shadertoyDemo);
        const restart = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Restart the demo",
        })) as Gtk.Button;
        const clear = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Clear the text view",
        })) as Gtk.Button;
        expect(restart).toBeInstanceOf(Gtk.Button);
        expect(clear).toBeInstanceOf(Gtk.Button);

        for (const presetName of ["Alien Planet", "Mandelbrot", "Neon", "Cogs", "Glowing Stars"]) {
            const button = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: presetName })) as Gtk.Button;
            expect(button).toBeInstanceOf(Gtk.Button);
        }
    });

    it("clears the editor buffer when the Clear button is activated", async () => {
        await renderDemo(shadertoyDemo);
        await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        expect(screen.getByDisplayValue(/.+/)).toBeTruthy();

        const clear = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Clear the text view",
        })) as Gtk.Button;
        await userEvent.click(clear);
        await waitFor(() => expect(screen.queryByDisplayValue(/.+/)).toBeNull());
    });

    it("loads the Mandelbrot shader into the buffer when the Mandelbrot preset is activated", async () => {
        await renderDemo(shadertoyDemo);
        await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        const mandelbrot = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Mandelbrot" })) as Gtk.Button;
        await userEvent.click(mandelbrot);
        await screen.findByDisplayValue(/MANDELBROT_ITER/);
        expect(screen.queryByDisplayValue(/MAX_DISTANCE/)).toBeNull();
    });

    it("propagates user edits to the buffer", async () => {
        await renderDemo(shadertoyDemo);
        const sourceView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        await userEvent.clear(sourceView);
        await userEvent.type(sourceView, "// custom shader");
        await screen.findByDisplayValue("// custom shader");
    });
});
