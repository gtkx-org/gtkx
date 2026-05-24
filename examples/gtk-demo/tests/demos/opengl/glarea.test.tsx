import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
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
});
