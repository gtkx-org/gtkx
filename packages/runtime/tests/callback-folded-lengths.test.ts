import { t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { wrapCallbackValue } from "../src/callback.js";

type Closure = (...args: unknown[]) => unknown;
type Ref = { value: unknown };

const outArrayAfterUserData = t.callback(
    [t.uint32, t.uint32, t.uint64, t.ref(t.sizedArray(t.int32, 4, "full")), t.ref(t.int32)],
    t.void,
    { hasUserData: true, userDataIndex: 2 },
);

const returnArrayAfterUserData = t.callback([t.int32, t.uint64, t.ref(t.int32)], t.sizedArray(t.float64, 2, "full"), {
    hasUserData: true,
    userDataIndex: 1,
});

const wrap = (spec: ReturnType<typeof t.callback>, callback: unknown): Closure =>
    wrapCallbackValue(spec, callback) as Closure;

describe("callbacks that declare user data ahead of an array's length parameter", () => {
    it("writes an out array and its length into the arguments the closure receives", () => {
        const wrapped = wrap(outArrayAfterUserData, (first: number, last: number) => [first, first + 1, last]);
        const array: Ref = { value: null };
        const length: Ref = { value: 0 };
        wrapped(4, 9, array, length);
        expect(array.value).toEqual([4, 5, 9]);
        expect(length.value).toBe(3);
    });

    it("writes a returned array's length into the argument the closure receives it in", () => {
        const wrapped = wrap(returnArrayAfterUserData, (count: number) => Array.from({ length: count }, (_, i) => i));
        const length: Ref = { value: 0 };
        expect(wrapped(4, length)).toEqual([0, 1, 2, 3]);
        expect(length.value).toBe(4);
    });
});
