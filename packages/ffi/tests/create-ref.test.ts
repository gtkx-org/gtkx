import { describe, expect, it } from "vitest";
import { createRef } from "../src/index.js";

describe("createRef", () => {
    it("creates a ref object", () => {
        const ref = createRef();
        expect(ref).toBeDefined();
        expect(typeof ref).toBe("object");
    });
});
