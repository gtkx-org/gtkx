import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
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
    });

    it("renders a GtkGLArea inside the demo", async () => {
        await renderDemo(gearsDemo);
        const glArea = await screen.findByName("gl-area");
        expect(glArea).toBeInstanceOf(Gtk.GLArea);
    });
});
