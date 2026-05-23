import { describe, expect, it, vi } from "vitest";

vi.mock("@gtkx/react", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@gtkx/react");
    return { ...actual, GtkGLArea: () => null };
});

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

    it("renders the demo without crashing the worker", async () => {
        await renderDemo(gearsDemo);
    });
});
