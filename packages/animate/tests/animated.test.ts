import { describe, expect, it } from "vitest";
import { animated } from "../src/animated.js";

describe("animated proxy", () => {
    it("memoizes the wrapper per custom component via create()", () => {
        const Component = (): null => null;

        expect(animated.create(Component)).toBe(animated.create(Component));
    });

    it("returns distinct wrappers for distinct custom components", () => {
        const First = (): null => null;
        const Second = (): null => null;

        expect(animated.create(First)).not.toBe(animated.create(Second));
    });

    it("passes reserved keys on the underlying factory through Reflect", () => {
        expect(typeof animated.name).toBe("string");
        expect(animated.create).toBe(animated.create);
    });
});
