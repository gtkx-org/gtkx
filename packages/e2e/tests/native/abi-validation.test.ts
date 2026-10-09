import { type Descriptor, t } from "@gtkx/runtime";
import { expect, test } from "vitest";

const bindRecord = (descriptor: Descriptor) =>
    t.bind("libgimarshallingtests.so", "gi_marshalling_tests_gvalue_flat_array_round_trip", [descriptor], t.void);

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
    for (const abiFields of [[], [t.void], [t.object()]]) {
        expect(() => bindRecord({ ...t.struct("borrowed", { size: 8 }), abiFields })).toThrow(
            /nonempty scalar or pointer storage/,
        );
    }
    expect(() => bindRecord({ ...t.struct("full", { size: 8 }), abiFields: [t.uint64] })).toThrow(
        /borrowed input ownership/,
    );
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
