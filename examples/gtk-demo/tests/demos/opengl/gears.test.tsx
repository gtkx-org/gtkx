import { describe, expect, it, vi } from "vitest";

vi.mock("@gtkx/react", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@gtkx/react");
    return { ...actual, GtkGLArea: () => null };
});

import { gearsDemo } from "../../../src/demos/opengl/gears.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

describe("gearsDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(gearsDemo, { id: "gears", title: "OpenGL/Gears" });
        expect(typeof gearsDemo.sourceCode).toBe("string");
        expect(gearsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(gearsDemo.component).toBeTypeOf("function");
    });

    it("renders the demo without crashing the worker", async () => {
        await renderDemo(gearsDemo);
    });
});
