import { describe, expect, it, vi } from "vitest";

vi.mock("@gtkx/react", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@gtkx/react");
    return { ...actual, GtkGLArea: () => null };
});

import { shadertoyDemo } from "../../../src/demos/opengl/shadertoy.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

describe("shadertoyDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(shadertoyDemo, { id: "shadertoy", title: "OpenGL/Shadertoy" });
        expect(typeof shadertoyDemo.sourceCode).toBe("string");
        expect(shadertoyDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(shadertoyDemo.component).toBeTypeOf("function");
    });

    it("renders the demo without crashing the worker", async () => {
        await renderDemo(shadertoyDemo);
    });
});
