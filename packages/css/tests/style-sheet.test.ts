import { describe, expect, it } from "vitest";
import { StyleSheet } from "../src/style-sheet.js";

describe("StyleSheet", () => {
    it("creates a StyleSheet instance with a key", () => {
        const sheet = new StyleSheet({ key: "test-key" });
        expect(sheet.key).toBe("test-key");
    });

    it("accepts rules via insert before GTK is ready", () => {
        const sheet = new StyleSheet({ key: "insert-test" });
        expect(() => {
            sheet.insert(".test { color: red; }");
        }).not.toThrow();
    });

    it("queues multiple rules before GTK is ready", () => {
        const sheet = new StyleSheet({ key: "queue-test" });
        expect(() => {
            sheet.insert(".rule1 { color: red; }");
            sheet.insert(".rule2 { color: blue; }");
            sheet.insert(".rule3 { color: green; }");
        }).not.toThrow();
    });

    it("allows flush without throwing when not registered", () => {
        const sheet = new StyleSheet({ key: "flush-test" });
        sheet.insert(".test { color: red; }");
        expect(() => {
            sheet.flush();
        }).not.toThrow();
    });

    it("allows applyQueuedRules to be called without throwing when no rules", () => {
        const sheet = new StyleSheet({ key: "apply-empty-test" });
        expect(() => {
            sheet.applyQueuedRules();
        }).not.toThrow();
    });

    it("allows applyQueuedRules to be called without throwing when rules are queued", () => {
        const sheet = new StyleSheet({ key: "apply-test" });
        sheet.insert(".test { color: red; }");
        expect(() => {
            sheet.applyQueuedRules();
        }).not.toThrow();
    });

    it("hydrate accepts an empty array without throwing", () => {
        const sheet = new StyleSheet({ key: "hydrate-test" });
        expect(() => {
            sheet.hydrate([]);
        }).not.toThrow();
    });

    it("hydrate accepts an array of elements without throwing", () => {
        const sheet = new StyleSheet({ key: "hydrate-elements-test" });
        expect(() => {
            sheet.hydrate([{}, {}, {}]);
        }).not.toThrow();
    });

    it("can be flushed multiple times without error", () => {
        const sheet = new StyleSheet({ key: "multi-flush-test" });
        sheet.insert(".test { color: red; }");
        sheet.flush();
        sheet.flush();
        expect(() => {
            sheet.flush();
        }).not.toThrow();
    });

    it("can insert rules after flush", () => {
        const sheet = new StyleSheet({ key: "post-flush-test" });
        sheet.insert(".test1 { color: red; }");
        sheet.flush();
        expect(() => {
            sheet.insert(".test2 { color: blue; }");
        }).not.toThrow();
    });
});
