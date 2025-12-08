import { describe, expect, it } from "vitest";
import { isAppendable, isRemovable, isSingleChild } from "../src/predicates.js";

describe("predicates", () => {
    describe("isAppendable", () => {
        it("returns true for object with append function", () => {
            const widget = { append: () => {} };
            expect(isAppendable(widget as never)).toBe(true);
        });

        it("returns false for object without append", () => {
            const widget = {};
            expect(isAppendable(widget as never)).toBe(false);
        });

        it("returns false for object with non-function append", () => {
            const widget = { append: "not a function" };
            expect(isAppendable(widget as never)).toBe(false);
        });
    });

    describe("isSingleChild", () => {
        it("returns true for object with setChild function", () => {
            const widget = { setChild: () => {} };
            expect(isSingleChild(widget as never)).toBe(true);
        });

        it("returns false for object without setChild", () => {
            const widget = {};
            expect(isSingleChild(widget as never)).toBe(false);
        });

        it("returns false for object with non-function setChild", () => {
            const widget = { setChild: "not a function" };
            expect(isSingleChild(widget as never)).toBe(false);
        });
    });

    describe("isRemovable", () => {
        it("returns true for object with remove function", () => {
            const widget = { remove: () => {} };
            expect(isRemovable(widget as never)).toBe(true);
        });

        it("returns false for object without remove", () => {
            const widget = {};
            expect(isRemovable(widget as never)).toBe(false);
        });

        it("returns false for object with non-function remove", () => {
            const widget = { remove: "not a function" };
            expect(isRemovable(widget as never)).toBe(false);
        });
    });
});
