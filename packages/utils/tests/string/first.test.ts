import { lowerFirst, upperFirst } from "@gtkx/utils";
import { describe, expect, it } from "vitest";

describe("upperFirst", () => {
    it("capitalizes the first character of a string", () => {
        expect(upperFirst("hello")).toBe("Hello");
        expect(upperFirst("world")).toBe("World");
    });

    it("leaves already capitalized strings unchanged", () => {
        expect(upperFirst("Hello")).toBe("Hello");
    });

    it("preserves the remainder of the string including casing", () => {
        expect(upperFirst("hELLO WORLD")).toBe("HELLO WORLD");
        expect(upperFirst("camelCase")).toBe("CamelCase");
    });

    it("handles single-character strings", () => {
        expect(upperFirst("a")).toBe("A");
        expect(upperFirst("Z")).toBe("Z");
    });

    it("handles empty strings and non-alpha first characters", () => {
        expect(upperFirst("")).toBe("");
        expect(upperFirst("123abc")).toBe("123abc");
        expect(upperFirst("-hello")).toBe("-hello");
    });
});

describe("lowerFirst", () => {
    it("lowercases the first character of a string", () => {
        expect(lowerFirst("Hello")).toBe("hello");
        expect(lowerFirst("World")).toBe("world");
    });

    it("leaves already lowercased strings unchanged", () => {
        expect(lowerFirst("hello")).toBe("hello");
    });

    it("preserves the remainder of the string including casing", () => {
        expect(lowerFirst("HELLO WORLD")).toBe("hELLO WORLD");
        expect(lowerFirst("PascalCase")).toBe("pascalCase");
    });

    it("handles single-character strings", () => {
        expect(lowerFirst("A")).toBe("a");
        expect(lowerFirst("z")).toBe("z");
    });

    it("handles empty strings and non-alpha first characters", () => {
        expect(lowerFirst("")).toBe("");
        expect(lowerFirst("123ABC")).toBe("123ABC");
        expect(lowerFirst("-Hello")).toBe("-Hello");
    });
});
