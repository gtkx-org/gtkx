import * as GObject from "@gtkx/gi/gobject";
import { type Descriptor, getHandle, t } from "@gtkx/runtime";
import { expect, test } from "vitest";

const bindRecord = (descriptor: Descriptor) =>
    t.bind("libgimarshallingtests.so", "gi_marshalling_tests_gvalue_flat_array_round_trip", [descriptor], t.void);

test.each(["boxed", "struct"])("%s record ABI fields accept public scalar descriptors", (kind) => {
    const value = t.boxed("GValue", {
        sharedLibrary: "libgobject-2.0.so.0",
        getTypeFnName: "g_value_get_type",
        size: 24,
        fallbackClass: () => GObject.Value,
    });
    const record: Descriptor = {
        ...(kind === "boxed" ? value : t.struct("borrowed", { size: 24 })),
        abiFields: [t.biguint64, t.boolean, t.unichar, t.enum("", "", true), t.flags("", "", false)],
    };
    const roundTrip = t.fn("libgimarshallingtests.so", "gi_marshalling_tests_gvalue_flat_array_round_trip", {
        args: [{ type: record }, { type: record }, { type: record }],
        returns: t.fixedArray({ ...value, ownership: "full" }, 3, "full", { elementSize: 24 }),
    });
    const integer = new GObject.Value();
    integer.init(GObject.TYPE_INT);
    integer.setInt(42);
    const number = new GObject.Value();
    number.init(GObject.TYPE_DOUBLE);
    number.setDouble(2.5);
    const boolean = new GObject.Value();
    boolean.init(GObject.TYPE_BOOLEAN);
    boolean.setBoolean(true);

    const [copiedInteger, copiedNumber, copiedBoolean] = roundTrip(
        getHandle(integer),
        getHandle(number),
        getHandle(boolean),
    ) as GObject.Value[];
    if (copiedInteger === undefined || copiedNumber === undefined || copiedBoolean === undefined) {
        throw new Error("Missing copied GValue");
    }
    integer.setInt(-7);
    number.setDouble(9.5);
    boolean.setBoolean(false);

    expect(copiedInteger.getInt()).toBe(42);
    expect(copiedNumber.getDouble()).toBe(2.5);
    expect(copiedBoolean.getBoolean()).toBe(true);
});

test("record value bindings reject incomplete and inconsistent native layouts", () => {
    for (const descriptor of [
        { ...t.struct(), abiFields: [t.uint64] },
        { ...t.struct("borrowed", { size: 0 }), abiFields: [t.uint64] },
        { ...t.boxed("GValue"), abiFields: [t.uint64] },
    ]) {
        expect(() => bindRecord(descriptor)).toThrow(/positive native size/);
    }
    for (const size of [1, 16]) {
        expect(() => bindRecord({ ...t.struct("borrowed", { size }), abiFields: [t.uint64] })).toThrow(
            /layout occupies 8 bytes/,
        );
    }
    for (const abiFields of [
        [],
        [t.void],
        [t.object()],
        [t.string()],
        [t.array(t.boolean)],
        [t.ref(t.unichar)],
        [t.callback([t.boolean], t.unichar)],
    ]) {
        expect(() => bindRecord({ ...t.struct("borrowed", { size: 8 }), abiFields })).toThrow(
            /nonempty scalar or pointer storage/,
        );
    }
    expect(() => bindRecord({ ...t.struct("full", { size: 8 }), abiFields: [t.uint64] })).toThrow(
        /borrowed input ownership/,
    );
});

test("record ABI fields reject recursive and excessively nested descriptors", () => {
    const recursive: Descriptor = { ...t.struct("borrowed", { size: 8 }), abiFields: [] };
    recursive.abiFields?.push(recursive);
    expect(() => bindRecord(recursive)).toThrow(/nesting|depth/i);
    recursive.abiFields = [t.uint64];
    expect(() => bindRecord(recursive)).not.toThrow();

    let nested: Descriptor = t.boolean;
    for (let depth = 0; depth < 40; depth += 1) {
        nested = { ...t.struct("borrowed", { size: 8 }), abiFields: [nested] };
    }
    expect(() => bindRecord(nested)).toThrow(/nesting|depth/i);
});

test("record values cannot enter unsupported return, nested, callback, or retained positions", () => {
    const record = { ...t.struct("borrowed", { size: 8 }), abiFields: [t.uint64] };
    const symbol = "gi_marshalling_tests_gvalue_flat_array_round_trip";
    expect(() => t.bind("libgimarshallingtests.so", symbol, [], record)).toThrow(/record returns/);
    for (const descriptor of [t.ref(record), t.array(record), t.hashTable(t.int32, record)]) {
        expect(() => bindRecord(descriptor)).toThrow(/direct synchronous function input/);
    }
    expect(() => bindRecord(t.callback([record], t.void))).toThrow(/record callback signatures/);
    expect(() =>
        t.bind("libgimarshallingtests.so", symbol, [record, t.callback([], t.void, { scope: "async" })], t.void),
    ).toThrow(/cannot outlive their source values/);
});

test("arrays without a native extent are rejected before any output call can run", () => {
    const input = t.array(t.int32, "input");
    const symbol = "gi_marshalling_tests_array_in_nonzero_nonlen";
    expect(() => t.bind("libgimarshallingtests.so", symbol, [], input)).toThrow(/without an extent cannot be decoded/);
    for (const descriptor of [t.ref(input), t.ref(input, true), t.callback([input], t.void)]) {
        expect(() => t.bind("libgimarshallingtests.so", symbol, [descriptor], t.void)).toThrow(
            /without an extent cannot be decoded/,
        );
    }
    expect(() => t.bind("libgimarshallingtests.so", symbol, [], t.array(input))).toThrow(
        /without an extent cannot be decoded/,
    );
});
