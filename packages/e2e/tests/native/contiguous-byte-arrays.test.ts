import type { ExternalObject, Handle, Ref } from "@gtkx/native";
import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const contents = [0, 49, 255, 51];
const terminatedContents = [1, 49, 255];
const library = fixtureLibrary("contiguous-byte-values");
const modes = [
    { isBytes: false, preserveNull: false },
    { isBytes: false, preserveNull: true },
    { isBytes: true, preserveNull: false },
    { isBytes: true, preserveNull: true },
];

const bytesFor = (isBytes: boolean, values: number[]): number[] | Uint8Array =>
    isBytes ? Uint8Array.from(values) : values;

const expectedStates = (isBytes: boolean, shouldPreserveNull: boolean, values: number[]): unknown[] => [
    shouldPreserveNull ? null : bytesFor(isBytes, []), bytesFor(isBytes, []), bytesFor(isBytes, values),
];

test.each(modes)("contiguous byte results preserve their public shape (%o)", ({ isBytes, preserveNull }) => {
    const sized = { ...t.sizedArray(t.uint8, 1, "borrowed", { isBytes }), preserveNull };
    const readSized = t.bind(library, "gtkx_u8_result", [t.int32, t.ref(t.uint64)], sized);
    const terminated = { ...t.array(t.uint8, "array", "borrowed", { isBytes }), preserveNull };
    const readTerminated = t.bind(library, "gtkx_u8_terminated", [t.int32], terminated);
    const garray = { ...t.gArray(t.uint8, "full", { isBytes }), preserveNull };
    const readGArray = t.bind(library, "gtkx_u8_garray", [t.int32], garray);
    const expected = expectedStates(isBytes, preserveNull, contents);
    const expectedTerminated = expectedStates(isBytes, preserveNull, terminatedContents);

    for (const [state, value] of expected.entries()) {
        const length = { value: null };
        expect(readSized(state, length)).toEqual(value);
        expect(length.value).toBe(state === 2 ? contents.length : 0);
        expect(readTerminated(state)).toEqual(expectedTerminated[state]);
        expect(readGArray(state)).toEqual(value);
    }

    const readFixed = t.bind(library, "gtkx_u8_result", [t.int32, t.ref(t.uint64)],
        t.fixedArray(t.uint8, contents.length, "borrowed", { isBytes }));
    expect(readFixed(2, { value: null })).toEqual(expected[2]);
    const readFull = t.bind(library, "gtkx_u8_full", [t.ref(t.uint64)],
        t.sizedArray(t.uint8, 0, "full", { isBytes }));
    expect(readFull({ value: null })).toEqual(expected[2]);
    const cursor = t.bind(library, "gtkx_u8_cursor", [t.sizedArray(t.uint8, 1), t.uint64, t.uint64],
        t.cursorArray(t.uint8, { baseParamIndex: 0, sizeParamIndex: 1 }, "borrowed", { isBytes }));
    expect(cursor(contents, contents.length, 3)).toEqual(bytesFor(isBytes, contents.slice(1)));
});

test.each(modes)("contiguous byte out refs preserve their public shape (%o)", ({ isBytes, preserveNull }) => {
    const sized = { ...t.sizedArray(t.uint8, 2, "borrowed", { isBytes }), preserveNull };
    const out = t.bind(library, "gtkx_u8_out", [t.int32, t.ref(sized), t.ref(t.uint64)], t.void);
    const garray = { ...t.gArray(t.uint8, "full", { isBytes }), preserveNull };
    const outGArray = t.bind(library, "gtkx_u8_garray_out", [t.int32, t.ref(garray)], t.void);
    const expected = expectedStates(isBytes, preserveNull, contents);

    for (const [state, value] of expected.entries()) {
        const raw = { value: null };
        const managed = { value: null };
        out(state, raw, { value: null });
        outGArray(state, managed);
        expect(raw.value).toEqual(value);
        expect(managed.value).toEqual(value);
    }

    const allocated = t.fixedArray(t.uint8, contents.length, "borrowed", { isBytes, isCallerAllocated: true });
    const fill = t.bind(library, "gtkx_u8_fill", [t.ref(allocated)], t.void);
    const output = { value: null };
    fill(output);
    expect(output.value).toEqual(expected[2]);
});

test.each(modes)("byte callback inputs and fields preserve their shape (%o)", ({ isBytes, preserveNull }) => {
    const sized = { ...t.sizedArray(t.uint8, 1, "borrowed", { isBytes }), preserveNull };
    const visit = t.bind(library, "gtkx_u8_visit", [
        t.int32, t.callback([sized, t.uint64], t.void, { scope: "call" }),
    ], t.void);
    const seen: unknown[] = [];
    const lengths: unknown[] = [];
    const readRecord = t.bind(library, "gtkx_u8_record", [t.int32], t.struct());
    const field = t.field({ ...t.array(t.uint8, "array", "borrowed", { isBytes }), preserveNull }, 0);
    const fields: unknown[] = [];

    for (const state of [0, 1, 2]) {
        visit(state, (value: unknown, length: unknown) => {
            seen.push(value);
            lengths.push(length);
        });
        fields.push(field.read(readRecord(state) as ExternalObject<Handle>));
    }

    expect(seen).toEqual(expectedStates(isBytes, preserveNull, contents));
    expect(fields).toEqual(expectedStates(isBytes, preserveNull, terminatedContents));
    expect(lengths).toEqual([0, 0, contents.length]);
});

test.each([false, true])("contiguous byte callback outputs preserve their shape (%s)", (isBytes) => {
    const fixed = t.fixedArray(t.uint8, contents.length, "full", { isBytes });
    const invoke = t.bind(library, "gtkx_u8_callback_return", [t.callback([], fixed, { scope: "call" })], fixed);
    const expected = bytesFor(isBytes, contents);
    expect(invoke(() => contents)).toEqual(expected);

    for (const isInout of [false, true]) {
        const sized = { ...t.sizedArray(t.uint8, 1, "full", { isBytes }), preserveNull: true };
        const callback = t.callback([t.ref(sized, isInout), t.ref(t.uint64, isInout)], t.void, { scope: "call" });
        const invokeRef = t.bind(library, "gtkx_u8_callback_ref", [t.boolean, callback, t.ref(t.uint64)],
            t.sizedArray(t.uint8, 2, "full", { isBytes }));
        const seen: unknown[] = [];
        const length = { value: null };
        const returned = invokeRef(isInout, (value: Ref, size: Ref) => {
            seen.push(value.value);
            value.value = contents;
            size.value = contents.length;
        }, length);
        expect(seen).toEqual([isInout ? expected : null]);
        expect(returned).toEqual(expected);
        expect(length.value).toBe(contents.length);
    }
});

test("contiguous byte inputs keep borrowed views and owned numeric arrays", () => {
    const increment = t.bind(library, "gtkx_u8_increment", [t.sizedArray(t.uint8, 1), t.uint64], t.void);
    const values = [1, 2, 3, 4];
    increment(values, values.length);
    expect(values).toEqual([1, 2, 3, 4]);
    const backing = new Uint8Array([99, 1, 2, 3, 4, 99]);
    increment(backing.subarray(1, 5), 4);
    expect(backing).toEqual(new Uint8Array([99, 2, 3, 4, 5, 99]));
    const take = t.bind(library, "gtkx_u8_take", [t.sizedArray(t.uint8, 1, "full"), t.uint64], t.uint32);
    expect(take(contents, contents.length)).toBe(355);
    const takeGArray = t.bind(library, "gtkx_u8_garray_take", [t.gArray(t.uint8, "full")], t.uint32);
    expect(takeGArray(contents)).toBe(355);
    expect(contents).toEqual([0, 49, 255, 51]);
});
