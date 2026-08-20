import * as Pango from "@gtkx/gi/pango";
import { t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const rectangleFfi = t.struct("borrowed", { size: 16, wrapperClass: Pango.Rectangle });

const extentsArg = (isConsumed: boolean) =>
    isConsumed
        ? ({ type: rectangleFfi, direction: "inout", isCallerAllocated: true, isConsumed: true } as const)
        : ({ type: rectangleFfi, direction: "inout", isCallerAllocated: true } as const);

const bindExtentsToPixels = (isConsumed: boolean) =>
    t.fn("libpango-1.0.so.0", "pango_extents_to_pixels", {
        args: [extentsArg(isConsumed), extentsArg(isConsumed)],
        returns: t.void,
    });

const pangoRect = (): Pango.Rectangle => new Pango.Rectangle({ x: 2048, y: 1024, width: 3072, height: 2048 });

describe("consumed caller-allocated inout parameters", () => {
    it("mutates the caller's instances in place and packs nothing into the result", () => {
        const extentsToPixels = bindExtentsToPixels(true);
        const inclusive = pangoRect();
        const nearest = pangoRect();
        expect(extentsToPixels(inclusive, nearest)).toBeUndefined();
        expect([inclusive.x, inclusive.y, inclusive.width, inclusive.height]).toEqual([2, 1, 3, 2]);
        expect([nearest.x, nearest.y, nearest.width, nearest.height]).toEqual([2, 1, 3, 2]);
    });

    it("still packs the caller's instance into the result when the argument is not consumed", () => {
        const extentsToPixels = bindExtentsToPixels(false);
        const inclusive = pangoRect();
        const nearest = pangoRect();
        const result = extentsToPixels(inclusive, nearest);
        expect(Array.isArray(result)).toBe(true);
        expect((result as unknown[])[0]).toBe(inclusive);
        expect((result as unknown[])[1]).toBe(nearest);
        expect([inclusive.x, inclusive.y, inclusive.width, inclusive.height]).toEqual([2, 1, 3, 2]);
    });

    it("passes a null consumed inout through and still mutates the caller's other instance", () => {
        const extentsToPixels = bindExtentsToPixels(true);
        const nearest = pangoRect();
        expect(extentsToPixels(null, nearest)).toBeUndefined();
        expect([nearest.x, nearest.y, nearest.width, nearest.height]).toEqual([2, 1, 3, 2]);
    });
});
