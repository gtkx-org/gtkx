import { describe, expect, it } from "vitest";
import { buildCss } from "../src/build-css.js";

describe("buildCss", () => {
    it("returns the empty string when no properties are set", () => {
        expect(buildCss("anim", {})).toBe("");
    });

    it("emits an opacity style declaration", () => {
        expect(buildCss("anim", { opacity: 0.5 })).toBe(".anim { opacity: 0.5; }");
    });

    it("coalesces translateX and translateY into a single translate fragment", () => {
        expect(buildCss("anim", { translateX: 10, translateY: 20 })).toBe(
            ".anim { transform: translate(10px, 20px); }",
        );
    });

    it("defaults a missing translate axis to zero", () => {
        expect(buildCss("anim", { translateX: 10 })).toBe(".anim { transform: translate(10px, 0px); }");
    });

    it("lets scale shadow scaleX and scaleY", () => {
        expect(buildCss("anim", { scale: 2, scaleX: 5, scaleY: 7 })).toBe(".anim { transform: scale(2); }");
    });

    it("uses the two-axis scale form when scale is absent", () => {
        expect(buildCss("anim", { scaleX: 2, scaleY: 3 })).toBe(".anim { transform: scale(2, 3); }");
    });

    it("defaults a missing scale axis to one", () => {
        expect(buildCss("anim", { scaleX: 2 })).toBe(".anim { transform: scale(2, 1); }");
    });

    it("orders style declarations before transform fragments in the declared order", () => {
        const css = buildCss("anim", {
            opacity: 0.5,
            translateX: 10,
            scale: 2,
            rotate: 45,
            skewX: 5,
            skewY: 6,
        });
        expect(css).toBe(
            ".anim { opacity: 0.5; transform: translate(10px, 0px) scale(2) rotate(45deg) skewX(5deg) skewY(6deg); }",
        );
    });
});
