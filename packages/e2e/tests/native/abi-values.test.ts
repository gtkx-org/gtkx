import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import * as Utility from "@gtkx/gi/utility";
import { expect, test } from "vitest";

test("input arrays without GIR extents marshal their supplied buffers", () => {
    expect(() => GIMarshallingTests.arrayInNonzeroNonlen(1, [97, 98, 99, 100])).not.toThrow();
    expect(() => GIMarshallingTests.arrayInNonzeroNonlen(2, new Uint8Array([97, 98, 99, 100]))).not.toThrow();
    const object = new Regress.AnnotationObject({});
    expect(object.computeSum([1, 2, 3])).toBeUndefined();
    expect(object.computeSum(new Int32Array([4, 5]))).toBeUndefined();
});

test("foreign record arguments pass their complete native value", () => {
    const object = new Utility.Object({});
    const record = new Utility.Struct({ field: 42, bitfield1: 5, bitfield2: 2 });
    record.data = new Uint8Array(16).fill(7);
    expect(Regress.fooMethodExternalReferences(object, Utility.EnumType.B, Utility.FlagType.A, record)).toBeUndefined();
    expect(record.field).toBe(42);
    expect(record.bitfield1).toBe(5);
    expect(record.bitfield2).toBe(2);
    expect(record.data).toEqual(new Uint8Array(16).fill(7));
});

test("caller-allocated record arrays use the requested capacity", () => {
    expect(Regress.testArrayStructOutCallerAlloc(0)).toEqual([]);
    const records = Regress.testArrayStructOutCallerAlloc(3);
    expect(records.map((record) => record.someInt)).toEqual([111, 222, 333]);
    expect(Regress.testArrayStructOutCallerAlloc(1).map((record) => record.someInt)).toEqual([111]);
    for (const capacity of [-1, 1.5, Number.MAX_SAFE_INTEGER, Number.POSITIVE_INFINITY]) {
        expect(() => Regress.testArrayStructOutCallerAlloc(capacity)).toThrow();
    }
});
