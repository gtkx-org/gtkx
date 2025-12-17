import { describe, expect, it } from "vitest";
import { isInstantiating, setInstantiating } from "../src/index.js";

describe("isInstantiating", () => {
    it("is false by default", () => {
        expect(isInstantiating).toBe(false);
    });
});

describe("setInstantiating", () => {
    it("sets the isInstantiating flag", () => {
        expect(isInstantiating).toBe(false);
        setInstantiating(true);
        expect(isInstantiating).toBe(true);
        setInstantiating(false);
        expect(isInstantiating).toBe(false);
    });
});
