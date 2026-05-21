import { describe, expect, it, vi } from "vitest";

vi.mock("@gtkx/react", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@gtkx/react");
    return { ...actual, GtkGLArea: () => null };
});

import { glareaDemo } from "../../../src/demos/opengl/glarea.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

describe("glareaDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(glareaDemo, { id: "glarea", title: "OpenGL/OpenGL Area" });
        expect(typeof glareaDemo.sourceCode).toBe("string");
        expect(glareaDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(glareaDemo.component).toBeTypeOf("function");
    });

    it("renders the demo without crashing the worker", async () => {
        await renderDemo(glareaDemo);
    });
});
