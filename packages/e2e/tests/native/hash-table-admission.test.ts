import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { alloc, type Descriptor, registerClass, resolveType } from "@gtkx/native";
import { getHandle, t, typeFromName } from "@gtkx/runtime";
import { describe, expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const library = fixtureLibrary("numeric-hash-table-admission", "gobject-2.0");
const scalars = [
    { name: "int64", kind: 0, descriptor: t.bigint64, value: -9_007_199_254_740_993n },
    { name: "uint64", kind: 1, descriptor: t.biguint64, value: 9_007_199_254_740_993n },
    { name: "float32", kind: 2, descriptor: t.float32, value: 1.5 },
    { name: "float64", kind: 3, descriptor: t.float64, value: -2.25 },
];

test("nested GPtrArray hash values validate their native wrappers and recover", () => {
    const gvalue = t.boxed("GValue", {
        sharedLibrary: "libgobject-2.0.so.0,libglib-2.0.so.0",
        getTypeFnName: "g_value_get_type",
    });
    const table = t.hashTable(t.string(), t.ptrArray(gvalue), "borrowed");
    const accept = t.fn(library, "gtkx_numeric_key_ignore", () => ({
        args: [{ type: table, isRequired: true }],
        returns: t.void,
    }));

    const object = new Regress.TestObj({});
    const mismatched = new Map([["values", [getHandle(object)]]]);
    expect(() => accept(mismatched)).toThrow();

    const value = new GObject.Value();
    value.init(typeFromName("gint"));
    value.setInt(42);
    accept(new Map([["values", [getHandle(value)]]]));
    expect(value.getInt()).toBe(42);
});

test("transferred callback tables reject borrowed string storage", () => {
    const descriptor = { ...t.hashTable(t.string(), t.string(), "full"), preserveNull: true };
    const roundtrip = t.fn(library, "gtkx_numeric_table_ref_callback", () => ({
        args: [{ type: t.callback([], descriptor, { scope: "call" }) }], returns: descriptor,
    }));

    expect(roundtrip(() => null)).toBeNull();
    expect(() => roundtrip(() => new Map([["key", "value"]]))).toThrow();
});

describe.each(scalars)("$name hash table admission", ({ kind, descriptor, value }) => {
    const borrowed = t.hashTable(t.string(), descriptor, "borrowed");
    const full = t.hashTable(t.string("full"), descriptor, "full");
    const expected = new Map([["value", value]]);

    test("decodes native full results and Ref outputs", () => {
        const produce = t.fn(library, "gtkx_numeric_table_values", () => ({
            args: [{ type: t.uint32 }], returns: full,
        }));
        const fill = t.fn(library, "gtkx_numeric_table_fill_slot", () => ({
            args: [{ type: full, direction: "out" }, { type: t.uint32 }], returns: t.void,
        }));
        const first = produce(kind);
        const second = produce(kind);

        expect(first).toEqual(expected);
        expect(second).toEqual(expected);
        expect(second).not.toBe(first);
        expect(fill(kind)).toEqual(expected);
    });

    test("decodes full table inputs to JavaScript callbacks", () => {
        const visit = t.fn(library, "gtkx_numeric_table_visit_owned", () => ({
            args: [{ type: t.uint32 }, { type: t.callback([full], t.void, { scope: "call" }) }],
            returns: t.void,
        }));
        const received: unknown[] = [];

        visit(kind, (table: unknown) => {
            received.push(table);
        });
        expect(received).toEqual([expected]);
    });

    test("retains borrowed callback results through a native table reference", () => {
        const roundtrip = t.fn(library, "gtkx_numeric_table_ref_callback", () => ({
            args: [{ type: t.callback([], borrowed, { scope: "call" }) }], returns: full,
        }));
        const source = new Map(expected);
        let calls = 0;
        const result = roundtrip(() => {
            calls++;

            return source;
        });

        expect(result).toEqual(expected);
        expect(result).not.toBe(source);
        expect(source).toEqual(expected);
        expect(calls).toBe(1);
    });

    test("rejects full numeric inputs before a consuming native call", () => {
        const consume = t.fn("libglib-2.0.so.0", "g_hash_table_unref", () => ({
            args: [{ type: full, isRequired: true }], returns: t.void,
        }));
        const source = new Map(expected);
        const empty: Map<string, number | bigint> = new Map();

        expect(() => consume(source)).toThrow();
        expect(() => consume(empty)).toThrow();
        expect(source).toEqual(expected);
        expect(empty.size).toBe(0);
    });

    test("rejects owned callback returns before the callback can be installed", () => {
        const accept = t.fn(library, "gtkx_numeric_table_accept_return", () => ({
            args: [{ type: t.callback([], full, { scope: "call" }) }], returns: t.boolean,
        }));
        let calls = 0;

        expect(() => accept(() => {
            calls++;

            return new Map(expected);
        })).toThrow();
        expect(calls).toBe(0);
        expect(accept(null)).toBe(false);
    });

    test.each([false, true])("rejects owned callback Ref outputs with inout=%s", (isInout) => {
        const accept = t.fn(library, "gtkx_numeric_table_accept_output", () => ({
            args: [{ type: t.callback([t.ref(full, isInout)], t.void, { scope: "call" }) }],
            returns: t.boolean,
        }));
        let calls = 0;

        expect(() => accept(() => {
            calls++;
        })).toThrow();
        expect(calls).toBe(0);
        expect(accept(null)).toBe(false);
    });

    test("preserves existing numeric field contents when replacement is rejected", () => {
        const size = t.bind(library, "gtkx_numeric_table_slot_size", [], t.uint64)();
        if (typeof size !== "number") {
            throw new TypeError("Expected a native storage size");
        }
        const holder = alloc(size);
        const read = t.field(borrowed, 0);
        const write = t.field(full, 0);
        t.bind(library, "gtkx_numeric_table_fill_slot", [t.struct(), t.uint32], t.void)(holder, kind);

        try {
            expect(read.read(holder)).toEqual([...expected]);
            expect(() => {
                write.write(holder, [["replacement", value]]);
            }).toThrow();
            expect(read.read(holder)).toEqual([...expected]);
        } finally {
            write.write(holder, null);
        }
        expect(read.read(holder)).toBeNull();
    });
});

test.each(scalars)("rejects full $name keys before a consuming native call", ({ descriptor, value }) => {
    const consume = t.fn("libglib-2.0.so.0", "g_hash_table_unref", () => ({
        args: [{ type: t.hashTable(descriptor, t.int32, "full"), isRequired: true }], returns: t.void,
    }));
    const source = new Map([[value, 1]]);

    expect(() => consume(source)).toThrow();
    expect(source).toEqual(new Map([[value, 1]]));
});

const floatScalars = scalars.filter(({ name }) => name.startsWith("float"));

test.each(floatScalars)("rejects full $name callback keys before installation", ({ descriptor, value }) => {
    const full = t.hashTable(descriptor, t.int32, "full");
    const accept = t.fn(library, "gtkx_numeric_table_accept_return", () => ({
        args: [{ type: t.callback([], full, { scope: "call" }) }], returns: t.boolean,
    }));
    let calls = 0;

    expect(() => accept(() => {
        calls++;

        return new Map([[value, 1]]);
    })).toThrow();
    expect(calls).toBe(0);
    expect(accept(null)).toBe(false);
});

test("rejects nested owned numeric callback outputs before installation", () => {
    const full = t.hashTable(t.string("full"), t.biguint64, "full");
    const accept = t.fn(library, "gtkx_numeric_table_accept_array_return", () => ({
        args: [{ type: t.callback([], t.ptrArray(full, "full"), { scope: "call" }) }],
        returns: t.boolean,
    }));
    let calls = 0;

    expect(() => accept(() => {
        calls++;

        return [new Map([["value", 1n]])];
    })).toThrow();
    expect(calls).toBe(0);
    expect(accept(null)).toBe(false);
});

test.each([false, true])("rejects full numeric vfunc outputs before publishing a class, out=%s", (output) => {
    const parent = resolveType(library, "gtkx_numeric_table_source_get_type");
    const offset = t.bind(library, "gtkx_numeric_table_source_slot", [t.boolean], t.uint64)(output);
    if (typeof offset !== "number") {
        throw new TypeError("Expected a native vfunc offset");
    }
    const full: Descriptor = {
        kind: "hashtable", ownership: "full", keyDescriptor: { kind: "bytes", ownership: "full" },
        valueDescriptor: { kind: "biguint64" },
    };
    const args: Descriptor[] = [{ kind: "object", ownership: "borrowed" }];
    if (output) {
        args.push({ kind: "ref", innerDescriptor: full });
    }
    const name = `GtkxNumericAdmission${output ? "Output" : "Return"}`;
    let calls = 0;

    expect(() => registerClass(name, parent, {
        vfuncs: [{
            byteOffset: offset,
            argDescriptors: args,
            returnDescriptor: output ? t.void : full,
            fn: () => {
                calls++;
            },
        }],
    })).toThrow();
    expect(calls).toBe(0);
    expect(typeFromName(name)).toBe(0n);
    const recovered = registerClass(name, parent);
    expect(recovered).toBeGreaterThan(0n);
    expect(typeFromName(name)).toBe(recovered);
});

const keyDescriptors = [
    { name: "int64", descriptor: t.bigint64 },
    { name: "uint64", descriptor: t.biguint64 },
    { name: "GType", descriptor: t.gtype },
];

describe.each(keyDescriptors)("$name hash table key capability", ({ descriptor }) => {
    test("rejects input, result and nested field descriptors during resolution", () => {
        for (const ownership of ["borrowed", "full"] as const) {
            const table = t.hashTable(descriptor, t.int32, ownership);
            const symbol = ownership === "full" ? "gtkx_numeric_key_consume" : "gtkx_numeric_key_ignore";
            expect(() => t.bind(library, symbol, [table], t.void)).toThrow();
            expect(() => t.bind(library, "gtkx_numeric_key_null", [], table)).toThrow();
            expect(() => t.field(t.ptrArray(table), 0)).toThrow();
            expect(() => t.field(t.hashTable(t.int32, table), 0)).toThrow();
        }
    });

    test("rejects null and empty inputs without changing the caller map", () => {
        const empty = new Map();
        for (const ownership of ["borrowed", "full"] as const) {
            const symbol = ownership === "full" ? "gtkx_numeric_key_consume" : "gtkx_numeric_key_ignore";
            const consume = t.fn(library, symbol, () => ({
                args: [{ type: t.hashTable(descriptor, t.int32, ownership) }], returns: t.void,
            }));
            expect(() => consume(null)).toThrow();
            expect(() => consume(empty)).toThrow();
        }
        expect(empty.size).toBe(0);
    });

    test("rejects null-result and Ref-output capabilities before entry", () => {
        for (const ownership of ["borrowed", "full"] as const) {
            const table = t.hashTable(descriptor, t.int32, ownership);
            const read = t.fn(library, "gtkx_numeric_key_null", () => ({ args: [], returns: table }));
            const output = t.fn(library, "gtkx_numeric_key_null_output", () => ({
                args: [{ type: table, direction: "out" }], returns: t.void,
            }));
            expect(() => read()).toThrow();
            expect(() => output()).toThrow();
        }
    });

    test("rejects callback input, result and output signatures even for a null callback", () => {
        const table = t.hashTable(descriptor, t.int32);
        const signatures = [
            { symbol: "gtkx_numeric_key_accept_input", type: t.callback([table], t.void, { scope: "call" }) },
            { symbol: "gtkx_numeric_table_accept_return", type: t.callback([], table, { scope: "call" }) },
            { symbol: "gtkx_numeric_table_accept_output", type: t.callback([t.ref(table)], t.void, { scope: "call" }) },
        ];
        let calls = 0;
        const callback = () => {
            calls++;

            return null;
        };

        for (const { symbol, type } of signatures) {
            const accept = t.fn(library, symbol, () => ({ args: [{ type }], returns: t.boolean }));
            expect(() => accept(callback)).toThrow();
            expect(() => accept(null)).toThrow();
        }
        expect(calls).toBe(0);
    });
});

test.each([false, true])("rejects key vfuncs before class publication, out=%s", (output) => {
    const parent = resolveType(library, "gtkx_numeric_table_source_get_type");
    const offset = t.bind(library, "gtkx_numeric_table_source_key_slot", [t.boolean], t.uint64)(output);
    if (typeof offset !== "number") {
        throw new TypeError("Expected a native vfunc offset");
    }
    const table: Descriptor = {
        kind: "hashtable", ownership: "borrowed", keyDescriptor: t.biguint64, valueDescriptor: t.int32,
    };
    const args: Descriptor[] = [{ kind: "object", ownership: "borrowed" }];
    if (output) {
        args.push({ kind: "ref", innerDescriptor: table });
    }
    const name = `GtkxNumericKeyAdmission${output ? "Output" : "Return"}`;
    let calls = 0;

    expect(() => registerClass(name, parent, {
        vfuncs: [{
            byteOffset: offset,
            argDescriptors: args,
            returnDescriptor: output ? t.void : table,
            fn: () => {
                calls++;

                return null;
            },
        }],
    })).toThrow();
    expect(calls).toBe(0);
    expect(typeFromName(name)).toBe(0n);
    const recovered = registerClass(name, parent);
    expect(typeFromName(name)).toBe(recovered);
    expect(recovered).toBeGreaterThan(0n);
});

test("preserves borrowed double keys and independent full-return maps", () => {
    const roundtrip = t.fn("libglib-2.0.so.0", "g_hash_table_ref", () => ({
        args: [{ type: t.hashTable(t.float64, t.int32), isRequired: true }],
        returns: t.hashTable(t.float64, t.int32, "full"),
    }));
    const source = new Map([[-1.25, -1], [0, 0], [2.5, 2]]);
    const first = roundtrip(source);
    const second = roundtrip(source);

    expect(first).toEqual(source);
    expect(first).not.toBe(source);
    expect(second).toEqual(source);
    expect(second).not.toBe(first);
    expect(roundtrip(new Map())).toEqual(new Map());
});

describe.each(["borrowed", "full"] as const)("GType hash table values with %s ownership", (ownership) => {
    const table = t.hashTable(t.string(), t.gtype, ownership);
    const symbol = ownership === "full" ? "gtkx_numeric_key_consume" : "gtkx_numeric_key_ignore";

    test("rejects input and result descriptors before native binding", () => {
        expect(() => t.bind(library, symbol, [table], t.void)).toThrow();
        expect(() => t.bind(library, "gtkx_numeric_key_null", [], table)).toThrow();
    });

    test("rejects null and empty inputs without changing the caller map", () => {
        const consume = t.fn(library, symbol, () => ({ args: [{ type: table }], returns: t.void }));
        const empty = new Map();

        expect(() => consume(null)).toThrow();
        expect(() => consume(empty)).toThrow();
        expect(empty.size).toBe(0);
    });

    test("rejects null results and Ref outputs before entry", () => {
        const read = t.fn(library, "gtkx_numeric_key_null", () => ({ args: [], returns: table }));
        const output = t.fn(library, "gtkx_numeric_key_null_output", () => ({
            args: [{ type: table, direction: "out" }], returns: t.void,
        }));

        expect(() => read()).toThrow();
        expect(() => output()).toThrow();
    });

    test("rejects callback inputs, results and Ref outputs including null callbacks", () => {
        const signatures = [
            { symbol: "gtkx_numeric_key_accept_input", type: t.callback([table], t.void, { scope: "call" }) },
            { symbol: "gtkx_numeric_table_accept_return", type: t.callback([], table, { scope: "call" }) },
            { symbol: "gtkx_numeric_table_accept_output", type: t.callback([t.ref(table)], t.void, { scope: "call" }) },
            {
                symbol: "gtkx_numeric_table_accept_output",
                type: t.callback([t.ref(table, true)], t.void, { scope: "call" }),
            },
            {
                symbol: "gtkx_numeric_table_accept_array_return",
                type: t.callback([], t.ptrArray(table), { scope: "call" }),
            },
        ];
        const entries: boolean[] = [];
        const callback = () => {
            entries.push(true);

            return null;
        };

        for (const { symbol, type } of signatures) {
            const accept = t.fn(library, symbol, () => ({ args: [{ type }], returns: t.boolean }));
            expect(() => accept(callback)).toThrow();
            expect(() => accept(null)).toThrow();
        }
        expect(entries).toEqual([]);
    });

    test("rejects direct and recursively nested field capabilities", () => {
        expect(() => t.field(table, 0)).toThrow();
        expect(() => t.field(t.ptrArray(table), 0)).toThrow();
        expect(() => t.field(t.list(table), 0)).toThrow();
        expect(() => t.field(t.hashTable(t.int32, table), 0)).toThrow();
    });
});

test("preserves scalar GType input and output descriptors", () => {
    const fundamental = t.bind("libgobject-2.0.so.0", "g_type_fundamental", [t.gtype], t.gtype);
    const name = t.bind("libgobject-2.0.so.0", "g_type_name", [t.gtype], t.string());
    const objectType = typeFromName("GObject");

    expect(objectType).toBeGreaterThan(0n);
    expect(fundamental(objectType)).toBe(objectType);
    expect(name(objectType)).toBe("GObject");
});
