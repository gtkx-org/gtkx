import { describe, expect, it } from "vitest";
import { StyleSheet } from "../src/style-sheet.js";

describe("StyleSheet", () => {
    it("creates a StyleSheet instance with a key", () => {
        const sheet = new StyleSheet({ key: "test-key" });
        expect(sheet.key).toBe("test-key");
    });

    it("accepts a rule via insert", () => {
        const sheet = new StyleSheet({ key: "insert-test" });
        expect(() => {
            sheet.insert(".test { color: red; }");
        }).not.toThrow();
    });

    it("accepts multiple rules via insert", () => {
        const sheet = new StyleSheet({ key: "queue-test" });
        expect(() => {
            sheet.insert(".rule1 { color: red; }");
            sheet.insert(".rule2 { color: blue; }");
            sheet.insert(".rule3 { color: green; }");
        }).not.toThrow();
    });
});
