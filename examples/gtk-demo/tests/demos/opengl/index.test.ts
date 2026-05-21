import { describe, expect, it } from "vitest";
import { openglDemos } from "../../../src/demos/opengl/index.js";

describe("openglDemos", () => {
    it("exposes the expected OpenGL demos in declared order", () => {
        expect(openglDemos.map((d) => d.id)).toEqual(["glarea", "gears", "shadertoy"]);
    });
});
