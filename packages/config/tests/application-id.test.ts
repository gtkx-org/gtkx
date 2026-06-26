import { describe, expect, it } from "vitest";
import { isValidApplicationId } from "../src/config.js";

describe("isValidApplicationId", () => {
    it("accepts a standard reverse-DNS application ID", () => {
        expect(isValidApplicationId("com.example.MyApp")).toBe(true);
    });

    it("accepts hyphens and underscores within elements", () => {
        expect(isValidApplicationId("com.example.my-app_v2")).toBe(true);
    });

    it("rejects an ID with no dots", () => {
        expect(isValidApplicationId("singletoken")).toBe(false);
    });

    it("rejects an empty string", () => {
        expect(isValidApplicationId("")).toBe(false);
    });

    it("rejects an ID exceeding 255 characters", () => {
        const long = `${"a".repeat(252)}.${"b".repeat(3)}`;
        expect(long.length).toBe(256);
        expect(isValidApplicationId(long)).toBe(false);
    });

    it("accepts an ID at the 255-character maximum", () => {
        const maxLength = `${"a".repeat(251)}.${"b".repeat(3)}`;
        expect(maxLength.length).toBe(255);
        expect(isValidApplicationId(maxLength)).toBe(true);
    });

    it("rejects an element starting with a digit", () => {
        expect(isValidApplicationId("com.4example.app")).toBe(false);
    });

    it("rejects whitespace and disallowed characters", () => {
        expect(isValidApplicationId("com.example.my app")).toBe(false);
        expect(isValidApplicationId("com.example.my$app")).toBe(false);
    });

    it("rejects trailing or leading dots", () => {
        expect(isValidApplicationId(".com.example")).toBe(false);
        expect(isValidApplicationId("com.example.")).toBe(false);
    });

    it("accepts a two-segment ID", () => {
        expect(isValidApplicationId("org.app")).toBe(true);
    });

    it("accepts single-character segments", () => {
        expect(isValidApplicationId("a.b")).toBe(true);
    });

    it("accepts a deeply nested ID", () => {
        expect(isValidApplicationId("com.example.sub.category.app")).toBe(true);
    });

    it("accepts elements containing digits after the first character", () => {
        expect(isValidApplicationId("org.gtkx123.app456")).toBe(true);
    });

    it("rejects an ID with consecutive dots", () => {
        expect(isValidApplicationId("com..app")).toBe(false);
    });

    it("rejects a segment starting with a hyphen", () => {
        expect(isValidApplicationId("com.-app.test")).toBe(false);
    });
});
