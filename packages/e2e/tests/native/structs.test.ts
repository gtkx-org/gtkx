import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as HarfBuzz from "@gtkx/gi/harfbuzz";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { drainAfterEachTest, drainGC } from "./helpers/memory.js";

drainAfterEachTest();

test("SimpleStruct round trips through construction, methods, and returnv", () => {
    const constructed = new GIMarshallingTests.SimpleStruct({ long: 6n, int8: 7 });
    constructed.inv();
    constructed.method();
    expect(constructed.long).toBe(6n);
    expect(constructed.int8).toBe(7);
    const returned = GIMarshallingTests.SimpleStruct.returnv();
    expect(returned.long).toBe(6n);
    expect(returned.int8).toBe(7);
    returned.inv();
});

test("SimpleStruct returnv returns a copy detached from the C singleton", () => {
    const first = GIMarshallingTests.SimpleStruct.returnv();
    first.long = 999n;
    expect(first.long).toBe(999n);
    const second = GIMarshallingTests.SimpleStruct.returnv();
    expect(second.long).toBe(6n);
    expect(second.int8).toBe(7);
});

test("SimpleStruct field writes land in the native memory C reads", () => {
    const struct = new GIMarshallingTests.SimpleStruct({});
    // @ts-expect-error the long field is declared bigint, and the binding widens it to a plain number
    struct.long = 6;
    struct.int8 = 7;
    expect(struct.long).toBe(6n);
    expect(struct.int8).toBe(7);
    struct.inv();
    struct.method();
});

test("NestedStruct inline struct field reads alias the owner", () => {
    const nested = new GIMarshallingTests.NestedStruct({
        simpleStruct: new GIMarshallingTests.SimpleStruct({ long: 1n, int8: 2 }),
    });
    expect(nested.simpleStruct.long).toBe(1n);
    expect(nested.simpleStruct.int8).toBe(2);
    const inner = nested.simpleStruct;
    inner.long = 55n;
    expect(nested.simpleStruct.long).toBe(55n);
    expect(nested.simpleStruct.int8).toBe(2);
});

test("NestedStruct inline struct field writes copy the donor struct", () => {
    const donor = new GIMarshallingTests.SimpleStruct({ long: 9n, int8: 4 });
    const nested = new GIMarshallingTests.NestedStruct({});
    nested.simpleStruct = donor;
    donor.long = 400n;
    expect(nested.simpleStruct.long).toBe(9n);
    expect(nested.simpleStruct.int8).toBe(4);
});

test("PointerStruct returnv exposes the expected field and passes inv", () => {
    const struct = GIMarshallingTests.PointerStruct.returnv();
    expect(struct.long).toBe(42n);
    struct.inv();
});

test("a pointer registered struct constructs from props", () => {
    const empty = new GIMarshallingTests.PointerStruct({});
    expect(empty.long).toBe(0n);

    const filled = new GIMarshallingTests.PointerStruct({ long: 42n });
    expect(filled.long).toBe(42n);
    filled.inv();

    filled.long = 43n;
    expect(filled.long).toBe(43n);
    expect(GIMarshallingTests.PointerStruct.returnv().long).toBe(42n);
});

test("many pointer registered structs survive collection", async () => {
    for (let index = 0; index < 1000; index += 1) {
        expect(new GIMarshallingTests.PointerStruct({ long: BigInt(index) }).long).toBe(BigInt(index));
    }

    await drainGC(5);
});

test("a struct handed over with its own free function is owned and usable", () => {
    const queue = GLib.AsyncQueue.new();
    expect(queue).toBeInstanceOf(GLib.AsyncQueue);
    expect(queue.length()).toBe(0);
    queue.lock();
    expect(queue.lengthUnlocked()).toBe(0);
    queue.unlock();
});

test("many structs released by their own free function survive collection", async () => {
    for (let index = 0; index < 1000; index += 1) {
        expect(GLib.AsyncQueue.new().length()).toBe(0);
    }

    await drainGC(5);
});

test("a pointer registered struct rejects field writes it cannot hold", () => {
    // @ts-expect-error a fractional number is not a long field value
    expect(() => new GIMarshallingTests.PointerStruct({ long: 1.5 })).toThrow();
    // @ts-expect-error a string is not a long field value
    expect(() => new GIMarshallingTests.PointerStruct({ long: "nope" })).toThrow();
    const struct = new GIMarshallingTests.PointerStruct({});
    expect(() => {
        // @ts-expect-error a symbol is not a long field value
        struct.long = Symbol("nope");
    }).toThrow();
});

test("Union round trips through returnv, construction, and field writes", () => {
    const returned = GIMarshallingTests.Union.returnv();
    expect(returned.long).toBe(42n);
    returned.inv();
    returned.method();
    const constructed = new GIMarshallingTests.Union({ long: 42n });
    expect(constructed.long).toBe(42n);
    constructed.inv();
    const written = new GIMarshallingTests.Union({});
    written.long = 42n;
    expect(written.long).toBe(42n);
    written.method();
});

test("StructuredUnion constructs each plain variant and reports its type", () => {
    const cases = [
        GIMarshallingTests.StructuredUnionType.NONE,
        GIMarshallingTests.StructuredUnionType.SIMPLE_STRUCT,
        GIMarshallingTests.StructuredUnionType.NESTED_STRUCT,
        GIMarshallingTests.StructuredUnionType.POINTER_STRUCT,
    ];
    for (const type of cases) {
        const union = GIMarshallingTests.StructuredUnion.new(type);
        expect(union.type()).toBe(type);
    }
});

test("StructuredUnion sub-struct wrappers expose inline parent fields as aliases", () => {
    const sub = new GIMarshallingTests.StructuredUnionSimpleStruct({
        type: GIMarshallingTests.StructuredUnionType.SIMPLE_STRUCT,
        parent: new GIMarshallingTests.SimpleStruct({ long: 6n, int8: 7 }),
    });
    expect(sub.type).toBe(GIMarshallingTests.StructuredUnionType.SIMPLE_STRUCT);
    expect(sub.parent.long).toBe(6n);
    expect(sub.parent.int8).toBe(7);
    const parent = sub.parent;
    parent.long = 12n;
    expect(sub.parent.long).toBe(12n);
});

test("TestStructA clone caller-allocates a deep copy", () => {
    const original = new Regress.TestStructA({
        someInt: 10,
        someInt8: 11,
        someDouble: 1.5,
        someEnum: Regress.TestEnum.VALUE2,
    });
    const clone = original.clone();
    expect(clone.someInt).toBe(10);
    expect(clone.someInt8).toBe(11);
    expect(clone.someDouble).toBe(1.5);
    expect(clone.someEnum).toBe(Regress.TestEnum.VALUE2);
    original.someInt = 77;
    expect(clone.someInt).toBe(10);
    clone.someInt = 500;
    expect(original.someInt).toBe(77);
});

test("TestStructA parse fills a caller-allocated out struct", () => {
    const parsed = Regress.TestStructA.parse("ignored");
    expect(parsed.someInt).toBe(23);
});

test("TestStructB clone deep copies the inline nested struct", () => {
    const original = new Regress.TestStructB({
        someInt8: 3,
        nestedA: new Regress.TestStructA({
            someInt: 5,
            someInt8: 6,
            someDouble: 2.5,
            someEnum: Regress.TestEnum.VALUE1,
        }),
    });
    const clone = original.clone();
    expect(clone.someInt8).toBe(3);
    expect(clone.nestedA.someInt).toBe(5);
    expect(clone.nestedA.someInt8).toBe(6);
    expect(clone.nestedA.someDouble).toBe(2.5);
    expect(clone.nestedA.someEnum).toBe(Regress.TestEnum.VALUE1);
    original.nestedA.someInt = 100;
    expect(clone.nestedA.someInt).toBe(5);
    expect(original.nestedA.someInt).toBe(100);
});

test("TestStructFixedArray frob fills the fixed array field", () => {
    const struct = new Regress.TestStructFixedArray({});
    struct.frob();
    expect(struct.justInt).toBe(7);
    expect(struct.array).toEqual([42, 43, 44, 45, 46, 47, 48, 49, 50, 51]);
});

test("a fixed-size array field round-trips exactly its own length", () => {
    const struct = new Regress.TestStructFixedArray({});
    struct.justInt = 5;
    expect(struct.justInt).toBe(5);
    struct.array = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    expect(struct.array).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    const readBack = struct.array;
    struct.array = readBack;
    expect(struct.array).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(struct.justInt).toBe(5);
});

test("a fixed-size array field writes as far as the value reaches", () => {
    const struct = new Regress.TestStructFixedArray({});
    struct.array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    expect(struct.array).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    struct.array = [9, 8];
    expect(struct.array).toEqual([9, 8, 3, 4, 5, 6, 7, 8, 9, 10]);

    struct.array = [];
    expect(struct.array).toEqual([9, 8, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("the fixed-size argument path rejects the same length mismatch", () => {
    GIMarshallingTests.arrayFixedIntIn([-1, 0, 1, 2]);

    expect(() => {
        GIMarshallingTests.arrayFixedIntIn([-1, 0, 1]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.arrayFixedIntIn([-1, 0, 1, 2, 3]);
    }).toThrow();
});

test("foo unions read back the member that was written", () => {
    const boxedUnion = Regress.FooBUnion.new();
    expect(boxedUnion.type).toBe(0);
    expect(boxedUnion.v).toBe(0);
    boxedUnion.type = 13;
    expect(boxedUnion.type).toBe(13);
    boxedUnion.v = 2.75;
    expect(boxedUnion.v).toBe(2.75);
    const plainUnion = new Regress.FooUnion({ regressFoo: 5 });
    expect(plainUnion.regressFoo).toBe(5);
    plainUnion.regressFoo = 9;
    expect(plainUnion.regressFoo).toBe(9);
});

test("plain object literals are rejected where a struct is expected", () => {
    // @ts-expect-error an object literal is not a SimpleStruct
    expect(() => new GIMarshallingTests.NestedStruct({ simpleStruct: { long: 3n, int8: 4 } })).toThrow();
    const nested = new GIMarshallingTests.NestedStruct({});
    expect(() => {
        // @ts-expect-error an object literal is not a SimpleStruct
        nested.simpleStruct = { long: 9n, int8: 1 };
    }).toThrow();
    expect(() => {
        GIMarshallingTests.SimpleStruct.prototype.inv.call({ long: 6n, int8: 7 });
    }).toThrow();
});

test("null is rejected for inline struct fields", () => {
    expect(() => new GIMarshallingTests.NestedStruct({ simpleStruct: null })).toThrow();
    const nested = new GIMarshallingTests.NestedStruct({});
    expect(() => {
        // @ts-expect-error an inline struct field is not nullable
        nested.simpleStruct = null;
    }).toThrow();
});

test("struct field writes reject out-of-range and mistyped values", () => {
    const simple = new GIMarshallingTests.SimpleStruct({});
    expect(() => {
        simple.int8 = 128;
    }).toThrow();
    expect(() => {
        simple.int8 = -129;
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not an int8 field value
        simple.int8 = Symbol("nope");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a fractional number is not a long field value
        simple.long = 1.5;
    }).toThrow();
    // @ts-expect-error a string is not a long field value
    expect(() => new GIMarshallingTests.SimpleStruct({ long: "nope" })).toThrow();
    const structA = new Regress.TestStructA({});
    expect(() => {
        // @ts-expect-error 12345 names no TestEnum member
        structA.someEnum = 12_345;
    }).toThrow();
});

test("abstract structs and unions cannot be constructed", () => {
    const abstractRecords: (new () => object)[] = [
        // @ts-expect-error NotSimpleStruct is abstract
        GIMarshallingTests.NotSimpleStruct,
        // @ts-expect-error UnregisteredUnion is abstract
        GIMarshallingTests.UnregisteredUnion,
        // @ts-expect-error TestStructC is abstract
        Regress.TestStructC,
        // @ts-expect-error TestStructD is abstract
        Regress.TestStructD,
        // @ts-expect-error TestStructE is abstract
        Regress.TestStructE,
        // @ts-expect-error TestStructF is abstract
        Regress.TestStructF,
    ];

    for (const AbstractRecord of abstractRecords) {
        expect(() => new AbstractRecord()).toThrow();
    }
});

test("a struct method whose C symbol is missing throws", () => {
    const union = Regress.FooBUnion.new();
    expect(() => union.getContainedType()).toThrow();
});

test("callables that pass or return a record by value are not bound at all", () => {
    // @ts-expect-error the callable is not bound
    expect(GIMarshallingTests.gvalueFlatArrayRoundTrip).toBeUndefined();
    // @ts-expect-error the callable is not bound
    expect(Regress.fooMethodExternalReferences).toBeUndefined();
});

test("records GIR spells without a star but that are really pointers still bind", () => {
    const bytes = GLib.Bytes.new([1, 2, 3]);
    expect(bytes.equal(GLib.Bytes.new([1, 2, 3]))).toBe(true);
    expect(bytes.equal(GLib.Bytes.new([1, 2, 4]))).toBe(false);
    expect(bytes.compare(GLib.Bytes.new([1, 2, 3]))).toBe(0);
    expect(typeof HarfBuzz.ftFontCreateReferenced).toBe("function");
    expect(typeof HarfBuzz.ftFaceCreateReferenced).toBe("function");
});
