import * as Regress from "@gtkx/gi/regress";
import { type Ref } from "@gtkx/native";
import { t } from "@gtkx/runtime";
import { describe, expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";

const library = fixtureLibrary("numeric-conversion");
const callback = t.callback([t.bigint64, t.ref(t.bigint64, true)], t.bigint64, { scope: "call" });
const invokeCallback = t.bind(library, "gtkx_i64_callback", [t.bigint64, callback, t.ref(t.bigint64)], t.bigint64);
const sumTerminated = t.bind(library, "gtkx_i64_terminated_sum", [t.array(t.bigint64)], t.bigint64);

test("native callbacks receive bigint values and normalize returned numbers and reference values", () => {
    const output: Ref = { value: null };
    const received: unknown[] = [];
    const result = invokeCallback(2 ** 53, (initial: bigint, updated: Ref) => {
        received.push(initial, updated.value);
        updated.value = -(2 ** 53);

        return 17;
    }, output);

    expect(received).toEqual([2n ** 53n, 2n ** 53n]);
    expect(output.value).toBe(-(2n ** 53n));
    expect(result).toBe(17n);
});

test.each([1.5, Infinity, 2 ** 53 + 2])("rejects callback number result %s", (value) => {
    expect(() => invokeCallback(1, () => value, { value: null })).toThrow();
});

test.each([1.5, Infinity, 2 ** 53 + 2])("rejects callback reference number %s", (value) => {
    expect(() => invokeCallback(1, (_initial: bigint, updated: Ref) => {
        updated.value = value;

        return 0;
    }, { value: null })).toThrow();
});

test("sized and terminated arrays normalize mixed number and bigint elements", () => {
    const values = [1, 2n, 3, 4n];

    expect(Regress.testArrayGint64In(values)).toBe(10n);
    expect(sumTerminated(values)).toBe(10n);
    expect(values).toEqual([1, 2n, 3, 4n]);
    expect(Regress.testArrayGint64In([])).toBe(0n);
    expect(sumTerminated([])).toBe(0n);
});

test.each([1.5, NaN, 2 ** 53 + 2])("rejects invalid numeric array element %s", (value) => {
    expect(() => Regress.testArrayGint64In([1n, value])).toThrow();
    expect(() => sumTerminated([1n, value])).toThrow();
});

describe.each([
    {
        name: "signed",
        descriptor: t.bigint64,
        symbol: "gtkx_i64_increment",
        storage: () => new BigInt64Array([4n, -2n, 2n ** 53n + 1n, 8n]),
        expected: [4n, -1n, 2n ** 53n + 2n, 8n],
    },
    {
        name: "unsigned",
        descriptor: t.biguint64,
        symbol: "gtkx_u64_increment",
        storage: () => new BigUint64Array([4n, 0n, 2n ** 64n - 2n, 8n]),
        expected: [4n, 1n, 2n ** 64n - 1n, 8n],
    },
])("$name typed numeric arrays", ({ descriptor, symbol, storage, expected }) => {
    const increment = t.bind(library, symbol, [t.sizedArray(descriptor, 1), t.uint32], t.void);

    test("preserve native writes through a bounded subarray", () => {
        const values = storage();
        increment(values.subarray(1, 3), 2);

        expect([...values]).toEqual(expected);
    });

    test("accept an empty view", () => {
        const values = storage();
        increment(values.subarray(0, 0), 0);

        expect([...values]).toEqual([...storage()]);
    });

    test("reject a typed view with the wrong element width", () => {
        expect(() => increment(new Int32Array([1, 2]), 2)).toThrow();
    });
});
