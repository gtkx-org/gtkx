import { describe, expect, it } from "vitest";
import { analyzeAsyncMethods } from "../../../src/core/utils/async-analysis.js";
import { createNormalizedMethod } from "../../fixtures/gir-fixtures.js";

describe("analyzeAsyncMethods", () => {
    it("returns empty sets for empty methods", () => {
        const result = analyzeAsyncMethods([]);
        expect(result.asyncMethods.size).toBe(0);
        expect(result.finishMethods.size).toBe(0);
        expect(result.asyncPairs.size).toBe(0);
    });

    it("returns empty sets for methods without finishFunc", () => {
        const methods = [createNormalizedMethod({ name: "show" }), createNormalizedMethod({ name: "hide" })];
        const result = analyzeAsyncMethods(methods);
        expect(result.asyncMethods.size).toBe(0);
        expect(result.finishMethods.size).toBe(0);
    });

    it("identifies async/finish pairs from finishFunc attribute", () => {
        const methods = [
            createNormalizedMethod({ name: "load_async", finishFunc: "load_finish" }),
            createNormalizedMethod({ name: "load_finish" }),
        ];
        const result = analyzeAsyncMethods(methods);
        expect(result.asyncMethods.has("load_async")).toBe(true);
        expect(result.finishMethods.has("load_finish")).toBe(true);
        expect(result.asyncPairs.get("load_async")).toBe("load_finish");
    });

    it("handles multiple async/finish pairs", () => {
        const methods = [
            createNormalizedMethod({ name: "load_async", finishFunc: "load_finish" }),
            createNormalizedMethod({ name: "load_finish" }),
            createNormalizedMethod({ name: "save_async", finishFunc: "save_finish" }),
            createNormalizedMethod({ name: "save_finish" }),
        ];
        const result = analyzeAsyncMethods(methods);
        expect(result.asyncMethods.size).toBe(2);
        expect(result.finishMethods.size).toBe(2);
        expect(result.asyncPairs.size).toBe(2);
        expect(result.asyncPairs.get("load_async")).toBe("load_finish");
        expect(result.asyncPairs.get("save_async")).toBe("save_finish");
    });

    it("ignores finishFunc when finish method does not exist", () => {
        const methods = [createNormalizedMethod({ name: "load_async", finishFunc: "load_finish" })];
        const result = analyzeAsyncMethods(methods);
        expect(result.asyncMethods.size).toBe(0);
        expect(result.finishMethods.size).toBe(0);
    });

    it("handles methods with non-matching finishFunc", () => {
        const methods = [
            createNormalizedMethod({ name: "load_async", finishFunc: "other_finish" }),
            createNormalizedMethod({ name: "load_finish" }),
        ];
        const result = analyzeAsyncMethods(methods);
        expect(result.asyncMethods.size).toBe(0);
        expect(result.asyncPairs.has("load_async")).toBe(false);
    });

    it("does not modify original methods array", () => {
        const methods = [
            createNormalizedMethod({ name: "load_async", finishFunc: "load_finish" }),
            createNormalizedMethod({ name: "load_finish" }),
        ];
        const originalLength = methods.length;
        analyzeAsyncMethods(methods);
        expect(methods.length).toBe(originalLength);
    });

    it("handles mixed async and regular methods", () => {
        const methods = [
            createNormalizedMethod({ name: "show" }),
            createNormalizedMethod({ name: "load_async", finishFunc: "load_finish" }),
            createNormalizedMethod({ name: "hide" }),
            createNormalizedMethod({ name: "load_finish" }),
            createNormalizedMethod({ name: "activate" }),
        ];
        const result = analyzeAsyncMethods(methods);
        expect(result.asyncMethods.size).toBe(1);
        expect(result.finishMethods.size).toBe(1);
        expect(result.asyncMethods.has("show")).toBe(false);
        expect(result.asyncMethods.has("hide")).toBe(false);
        expect(result.asyncMethods.has("load_async")).toBe(true);
    });
});
