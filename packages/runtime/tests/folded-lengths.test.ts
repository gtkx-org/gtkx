import { t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { foldedLengthSources } from "../src/folded-lengths.js";

const outArrayArgs = [t.object("borrowed"), t.ref(t.sizedArray(t.int32, 2, "full")), t.ref(t.int32)];

describe("arguments a callable folds its array lengths into", () => {
    it("names the argument carrying the length of a returned array", () => {
        const sources = foldedLengthSources([t.object("borrowed"), t.ref(t.int32)], t.sizedArray(t.float64, 1, "full"));
        expect(sources).toEqual(new Map([[1, [{ kind: "return" }]]]));
    });

    it("names the argument carrying the length of an out array", () => {
        const sources = foldedLengthSources(outArrayArgs, t.void);
        expect(sources).toEqual(new Map([[2, [{ kind: "outArg", argIndex: 1 }]]]));
    });

    it("keeps every source of a length a returned array and an out array share", () => {
        const sources = foldedLengthSources(outArrayArgs, t.sizedArray(t.float64, 2, "full"));
        expect(sources.get(2)).toEqual([{ kind: "return" }, { kind: "outArg", argIndex: 1 }]);
    });

    it("leaves the base length of a cursor array alone", () => {
        const cursor = t.cursorArray(t.uint8, { baseParamIndex: 0, sizeParamIndex: 1 }, "borrowed");
        const sources = foldedLengthSources([t.buffer, t.int64, t.ref(cursor)], t.void);
        expect(sources.size).toBe(0);
    });

    it("leaves a zero-terminated array with no length argument alone", () => {
        const strings = t.array(t.string("full"), "array", "full");
        const sources = foldedLengthSources([t.ref(strings)], t.void);
        expect(sources.size).toBe(0);
    });

    it("leaves an array an input argument passes in alone", () => {
        const sources = foldedLengthSources([t.sizedArray(t.int32, 1, "borrowed"), t.int32], t.void);
        expect(sources.size).toBe(0);
    });
});
