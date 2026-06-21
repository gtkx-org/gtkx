import { describe, expect, it } from "vitest";
import { interpolate } from "../src/interpolation.js";

describe("interpolate", () => {
    it("returns the from values at progress 0", () => {
        const result = interpolate({ opacity: 0, translateX: 10 }, { opacity: 1, translateX: 20 }, 0);
        expect(result).toEqual({ opacity: 0, translateX: 10 });
    });

    it("returns the to values at progress 1", () => {
        const result = interpolate({ opacity: 0, translateX: 10 }, { opacity: 1, translateX: 20 }, 1);
        expect(result).toEqual({ opacity: 1, translateX: 20 });
    });

    it("returns the midpoint at progress 0.5", () => {
        const result = interpolate({ opacity: 0, translateX: 10 }, { opacity: 1, translateX: 20 }, 0.5);
        expect(result).toEqual({ opacity: 0.5, translateX: 15 });
    });

    it("falls back to the neutral default when a key is only present on the to side", () => {
        const result = interpolate({}, { opacity: 0 }, 0.5);
        expect(result).toEqual({ opacity: 0.5 });
    });

    it("falls back to the neutral default when a key is only present on the from side", () => {
        const result = interpolate({ scale: 0 }, {}, 0.5);
        expect(result).toEqual({ scale: 0.5 });
    });

    it("uses zero as the neutral default for translation when one side is missing", () => {
        const result = interpolate({ translateX: 100 }, {}, 1);
        expect(result).toEqual({ translateX: 0 });
    });

    it("returns an empty keyframe when both keyframes are empty", () => {
        expect(interpolate({}, {}, 0.5)).toEqual({});
    });
});
