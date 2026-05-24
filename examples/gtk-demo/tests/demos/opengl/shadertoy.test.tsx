import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
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

    it("renders the main GtkGLArea panel", async () => {
        await renderDemo(shadertoyDemo);
        const glArea = await screen.findByName("shadertoy-gl-area");
        expect(glArea).toBeInstanceOf(Gtk.GLArea);
    });
});
