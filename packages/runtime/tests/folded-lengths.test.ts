import { t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { foldedLengthSources, type FoldedLengthSpec, type LengthSource } from "../src/folded-lengths.js";

type FoldCase = [string, FoldedLengthSpec, [number, LengthSource[]][]];

const outArrayArgs = [t.object("borrowed"), t.ref(t.sizedArray(t.int32, 2, "full")), t.ref(t.int32)];
const cursorArray = t.cursorArray(t.uint8, { baseParamIndex: 0, sizeParamIndex: 1 }, "borrowed");
const stringArray = t.array(t.string("full"), "array", "full");

const cases: FoldCase[] = [
    [
        "names the argument carrying the length of a returned array",
        {
            argDescriptors: [t.object("borrowed"), t.ref(t.int32)],
            returnDescriptor: t.sizedArray(t.float64, 1, "full"),
        },
        [[1, [{ kind: "return" }]]],
    ],
    [
        "names the argument carrying the length of an out array",
        { argDescriptors: outArrayArgs, returnDescriptor: t.void },
        [[2, [{ kind: "outArg", argIndex: 1 }]]],
    ],
    [
        "keeps every source of a length a returned array and an out array share",
        { argDescriptors: outArrayArgs, returnDescriptor: t.sizedArray(t.float64, 2, "full") },
        [[2, [{ kind: "return" }, { kind: "outArg", argIndex: 1 }]]],
    ],
    [
        "leaves the base length of a cursor array alone",
        { argDescriptors: [t.buffer, t.int64, t.ref(cursorArray)], returnDescriptor: t.void },
        [],
    ],
    [
        "leaves a zero-terminated array with no length argument alone",
        { argDescriptors: [t.ref(stringArray)], returnDescriptor: t.void },
        [],
    ],
    [
        "leaves an array an input argument passes in alone",
        { argDescriptors: [t.sizedArray(t.int32, 1, "borrowed"), t.int32], returnDescriptor: t.void },
        [],
    ],
    [
        "counts an out array and its length from the positions a closure receives",
        {
            argDescriptors: [t.uint32, t.uint64, t.ref(t.sizedArray(t.uint32, 3, "full")), t.ref(t.uint32)],
            returnDescriptor: t.void,
            userDataIndex: 1,
        },
        [[2, [{ kind: "outArg", argIndex: 1 }]]],
    ],
    [
        "counts a returned array's length from the positions a closure receives",
        {
            argDescriptors: [t.uint64, t.uint32, t.ref(t.uint32)],
            returnDescriptor: t.sizedArray(t.float64, 2, "full"),
            userDataIndex: 0,
        },
        [[1, [{ kind: "return" }]]],
    ],
    [
        "leaves the positions ahead of user data where they are",
        {
            argDescriptors: [t.uint32, t.ref(t.uint32), t.ref(t.sizedArray(t.uint32, 1, "full")), t.uint64],
            returnDescriptor: t.void,
            userDataIndex: 3,
        },
        [[1, [{ kind: "outArg", argIndex: 2 }]]],
    ],
];

describe("arguments a callable folds its array lengths into", () => {
    it.each(cases)("%s", (_name, spec, expected) => {
        expect(foldedLengthSources(spec)).toEqual(new Map(expected));
    });
});
