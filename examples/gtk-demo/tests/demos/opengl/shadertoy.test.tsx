import { freeze, unfreeze } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { act, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { shadertoyDemo } from "../../../src/demos/opengl/shadertoy.js";
import { renderDemo } from "../../test-utils.js";

vi.setConfig({ testTimeout: 30000 });

const readBufferText = (textView: Gtk.TextView): string => {
    const buffer = textView.getBuffer();
    freeze();
    try {
        const start = buffer.getStartIter();
        const end = buffer.getEndIter();
        return buffer.getText(start, end, false) ?? "";
    } finally {
        unfreeze();
    }
};

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
        expect(glArea).toBeInstanceOf(Gtk.GLArea);
        expect(glArea.getUseEs()).toBe(true);
        expect(glArea.getHexpand()).toBe(true);
        expect(glArea.getVexpand()).toBe(true);
    });

    it("seeds the source editor with the Alien Planet fragment shader", async () => {
        await renderDemo(shadertoyDemo);
        const sourceView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        const text = readBufferText(sourceView);
        expect(text).toContain("MAX_DISTANCE");
        expect(text).toContain("mountainColor");
        expect(text).toContain("void mainImage");
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
        const sourceView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        expect(readBufferText(sourceView).length).toBeGreaterThan(0);

        const clear = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Clear the text view",
        })) as Gtk.Button;
        await userEvent.click(clear);
        await waitFor(() => expect(readBufferText(sourceView)).toBe(""));
    });

    it("loads the Mandelbrot shader into the buffer when the Mandelbrot preset is activated", async () => {
        await renderDemo(shadertoyDemo);
        const sourceView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        const mandelbrot = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Mandelbrot" })) as Gtk.Button;
        await userEvent.click(mandelbrot);
        await waitFor(() => expect(readBufferText(sourceView)).toContain("MANDELBROT_ITER"));
        expect(readBufferText(sourceView)).not.toContain("MAX_DISTANCE");
    });

    it("propagates user edits to the buffer", async () => {
        await renderDemo(shadertoyDemo);
        const sourceView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        await act(() => sourceView.getBuffer().setText("// custom shader", -1));
        expect(readBufferText(sourceView)).toBe("// custom shader");
    });
});
