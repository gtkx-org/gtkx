import { describe, expect, it } from "vitest";
import { createRef } from "../../index.js";

describe("createRef", () => {
    it("creates a ref object with the given value", () => {
        const ref = createRef(42);

        expect(ref.value).toBe(42);
    });

    it("allows updating the value property", () => {
        const ref = createRef(0);
        ref.value = 100;

        expect(ref.value).toBe(100);
    });

    it("works with string values", () => {
        const ref = createRef("hello");

        expect(ref.value).toBe("hello");
    });

    it("works with null values", () => {
        const ref = createRef(null);

        expect(ref.value).toBe(null);
    });

    it("works with undefined values", () => {
        const ref = createRef(undefined);

        expect(ref.value).toBe(undefined);
    });

    it("works with object values", () => {
        const obj = { name: "test" };
        const ref = createRef(obj);

        expect(ref.value).toBe(obj);
    });

    describe("edge cases", () => {
        it("works with boolean false", () => {
            const ref = createRef(false);

            expect(ref.value).toBe(false);
        });

        it("works with empty string", () => {
            const ref = createRef("");

            expect(ref.value).toBe("");
        });

        it("works with zero", () => {
            const ref = createRef(0);

            expect(ref.value).toBe(0);
        });
    });
});
