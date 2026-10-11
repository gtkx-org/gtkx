import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";

const glib = "libglib-2.0.so.0";
const tableHandle = t.struct("borrowed", {
    sharedLibrary: glib,
    copyFnName: "g_hash_table_ref",
    freeFnName: "g_hash_table_unref",
});

const copyTable = (key: Parameters<typeof t.hashTable>[0], value: Parameters<typeof t.hashTable>[1]) =>
    t.bind(glib, "g_hash_table_ref", [t.hashTable(key, value)], t.hashTable(key, value, "full"));

test("Number64 hash keys and values retain direct pointer-word storage", () => {
    const signed = copyTable(t.int64, t.int64);
    const unsigned = copyTable(t.uint64, t.uint64);
    const values = [
        [-(2 ** 53), 2 ** 53],
        [-1, -17],
        [0, 0],
        [2 ** 53, -(2 ** 53)],
    ];
    expect(new Map(signed(values) as [number, number][])).toEqual(new Map(values as [number, number][]));
    expect(new Map(unsigned([[2 ** 53, 2 ** 53]]) as [number, number][])).toEqual(new Map([[2 ** 53, 2 ** 53]]));
    const lookup = t.bind(glib, "g_hash_table_lookup", [t.hashTable(t.int64, t.int64), t.int64], t.int64);
    expect(lookup(values, -1)).toBe(-17);
});

test.each(["glist", "gslist"] as const)("Number64 %s entries preserve signed negative words", (kind) => {
    const copy = t.bind(
        glib,
        kind === "glist" ? "g_list_copy" : "g_slist_copy",
        [t.array(t.int64, kind)],
        t.array(t.int64, kind, "full"),
    );
    expect(copy([-(2 ** 53), -17, 0, 2 ** 53])).toEqual([-(2 ** 53), -17, 0, 2 ** 53]);
});

test("hash keys that normalize to the same pointer replace earlier values", () => {
    const roundTrip = copyTable(t.unichar, t.int64);
    expect(
        roundTrip([
            ["A", 1],
            [65, 2],
            ["B", 3],
        ]),
    ).toEqual(
        expect.arrayContaining([
            ["A", 2],
            ["B", 3],
        ]),
    );
    expect(
        roundTrip([
            ["A", 1],
            [65, 2],
        ]),
    ).toHaveLength(1);
});

test("bigint callback lengths are exact and reject oversized extents before reading", () => {
    const visit = t.bind(
        glib,
        "g_list_foreach",
        [t.list(t.buffer), t.callback([t.sizedArray(t.int32, 1), t.biguint64], t.void, { scope: "call" }), t.biguint64],
        t.void,
    );
    const values = new Int32Array([-7, 0, 42]);
    const seen: unknown[] = [];
    visit([values], (array: unknown, length: unknown) => seen.push([array, length]), 3n);
    expect(seen).toEqual([[[-7, 0, 42], 3n]]);
    expect(() => visit([values], () => undefined, 2n ** 53n + 1n)).toThrow("9007199254740993");
    visit([values], (array: unknown) => seen.push(array), 3n);
    expect(seen.at(-1)).toEqual([-7, 0, 42]);
});

test("ref-bigint callback lengths preserve exact native words", () => {
    const visit = t.bind(
        glib,
        "g_list_foreach",
        [
            t.list(t.buffer),
            t.callback([t.sizedArray(t.int32, 1), t.ref(t.biguint64, true)], t.void, { scope: "call" }),
            t.buffer,
        ],
        t.void,
    );
    const values = new Int32Array([12, -34]);
    const length = new BigUint64Array([2n]);
    const seen: unknown[] = [];
    visit([values], (array: unknown, size: unknown) => seen.push([array, size]), length);
    expect(seen).toEqual([[[12, -34], { value: 2n }]]);
    length[0] = 2n ** 53n + 1n;
    expect(() => visit([values], () => undefined, length)).toThrow("9007199254740993");
    length[0] = 2n;
    visit([values], (array: unknown) => seen.push(array), length);
    expect(seen.at(-1)).toEqual([12, -34]);
});

test("Number64 return overflow releases copied arrays and list containers", () => {
    const copyArray = t.bind(
        glib,
        "g_memdup2",
        [t.fixedArray(t.biguint64, 1), t.biguint64],
        t.fixedArray(t.uint64, 1, "full"),
    );
    const copyList = t.bind(glib, "g_list_copy", [t.list(t.biguint64)], t.list(t.uint64, "full"));
    const source = [2n ** 53n + 1n];
    expect(() => copyArray(source, 8n)).toThrow(/2\^53|range|exact/);
    expect(() => copyList(source)).toThrow(/2\^53|range|exact/);
    expect(source).toEqual([2n ** 53n + 1n]);
    expect(copyArray([42n], 8n)).toEqual([42]);
    expect(copyList([42n])).toEqual([42]);
});

test("Number64 hash output overflow leaves the owned source usable", () => {
    const create = t.bind(glib, "g_hash_table_new", [t.buffer, t.buffer], { ...tableHandle, ownership: "full" });
    const insert = t.bind(glib, "g_hash_table_insert", [tableHandle, t.int32, t.biguint64], t.boolean);
    const read = t.bind(glib, "g_hash_table_ref", [tableHandle], t.hashTable(t.int32, t.uint64, "full"));
    const table = create(null, null);
    insert(table, 1, 2n ** 53n + 1n);
    expect(() => read(table)).toThrow(/2\^53|range|exact/);
    insert(table, 1, 42n);
    expect(read(table)).toEqual([[1, 42]]);
});

test("matching typed-array subviews retain caller-visible writes", () => {
    const sort = t.bind(
        "libc.so.6",
        "qsort",
        [
            t.array(t.int64),
            t.biguint64,
            t.biguint64,
            t.callback([t.indirect(t.int64), t.indirect(t.int64)], t.int32, { scope: "call" }),
        ],
        t.void,
    );
    const values = new BigInt64Array([99n, 7n, -2n, 4n, 88n]);
    sort(values.subarray(1, 4), 3n, 8n, (left: number, right: number) => left - right);
    expect([...values]).toEqual([99n, -2n, 4n, 7n, 88n]);
    expect(() => sort(new BigUint64Array([1n]), 1n, 8n, () => 0)).toThrow(/BigUint64Array|cannot supply/);
});

test("a late nested conversion failure rolls back earlier collection storage", () => {
    const size = t.bind(glib, "g_hash_table_size", [t.hashTable(t.string(), t.float64)], t.uint32);
    expect(() =>
        size([
            ["first", 1],
            ["last", "invalid"],
        ]),
    ).toThrow();
    expect(
        size([
            ["first", 1],
            ["last", 2],
        ]),
    ).toBe(2);
});

test("Number64 array descriptors pass matching exact typed words without Number conversion", () => {
    const equal = t.bind(glib, "g_int64_equal", [t.fixedArray(t.int64, 1), t.fixedArray(t.bigint64, 1)], t.boolean);
    const source = new BigInt64Array([99n, 2n ** 53n + 1n, 88n]);
    expect(equal(source.subarray(1, 2), [2n ** 53n + 1n])).toBe(true);
    expect([...source]).toEqual([99n, 2n ** 53n + 1n, 88n]);
});
