import { describe, expect, it, vi } from "vitest";

vi.mock("@gtkx/react", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@gtkx/react");
    return { ...actual, GtkGLArea: () => null };
});

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

    it("renders the demo without crashing the worker", async () => {
        await renderDemo(glareaDemo);
    });
});
