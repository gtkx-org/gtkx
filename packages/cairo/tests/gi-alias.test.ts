import * as cairo from "@gtkx/cairo";
import * as legacy from "@gtkx/gi/cairo";
import { describe, expect, it } from "vitest";

describe("the deprecated @gtkx/gi/cairo alias", () => {
    it("re-exports the @gtkx/cairo classes and enums", () => {
        expect(legacy.Context).toBe(cairo.Context);
        expect(legacy.ImageSurface).toBe(cairo.ImageSurface);
        expect(legacy.Pattern).toBe(cairo.Pattern);
        expect(legacy.Status.SUCCESS).toBe(cairo.Status.SUCCESS);
        expect(legacy.statusToString).toBe(cairo.statusToString);
    });

    it("constructs instances that satisfy the @gtkx/cairo classes", () => {
        const surface = new legacy.ImageSurface(legacy.Format.ARGB32, 1, 1);
        expect(surface).toBeInstanceOf(cairo.ImageSurface);
        expect(legacy.Context.create(surface)).toBeInstanceOf(cairo.Context);
    });
});
