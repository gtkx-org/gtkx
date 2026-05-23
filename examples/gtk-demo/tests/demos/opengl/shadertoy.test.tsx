import { describe, expect, it, vi } from "vitest";

vi.mock("@gtkx/react", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@gtkx/react");
    return { ...actual, GtkGLArea: () => null };
});

import { shadertoyDemo } from "../../../src/demos/opengl/shadertoy.js";
import { renderDemo } from "../../test-utils.js";

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

    it("renders the demo without crashing the worker", async () => {
        await renderDemo(shadertoyDemo);
    });
});
