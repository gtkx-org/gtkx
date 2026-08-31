import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as HarfBuzz from "@gtkx/gi/harfbuzz";
import * as Regress from "@gtkx/gi/regress";
import assert from "node:assert/strict";
import { test } from "node:test";
import { drainAfterEachTest, drainGC } from "./helpers/memory.mjs";

drainAfterEachTest();

test("SimpleStruct round trips through construction, methods, and returnv", () => {
    const constructed = new GIMarshallingTests.SimpleStruct({ long: 6n, int8: 7 });
    constructed.inv();
    constructed.method();
    assert.equal(constructed.long, 6n);
    assert.equal(constructed.int8, 7);
    const returned = GIMarshallingTests.SimpleStruct.returnv();
    assert.equal(returned.long, 6n);
    assert.equal(returned.int8, 7);
    returned.inv();
});

test("SimpleStruct returnv returns a copy detached from the C singleton", () => {
    const first = GIMarshallingTests.SimpleStruct.returnv();
    first.long = 999n;
    assert.equal(first.long, 999n);
    const second = GIMarshallingTests.SimpleStruct.returnv();
    assert.equal(second.long, 6n);
    assert.equal(second.int8, 7);
});

test("SimpleStruct field writes land in the native memory C reads", () => {
    const struct = new GIMarshallingTests.SimpleStruct({});
    struct.long = 6;
    struct.int8 = 7;
    assert.equal(struct.long, 6n);
    assert.equal(struct.int8, 7);
    struct.inv();
    struct.method();
});

test("NestedStruct inline struct field reads alias the owner", () => {
    const nested = new GIMarshallingTests.NestedStruct({
        simpleStruct: new GIMarshallingTests.SimpleStruct({ long: 1n, int8: 2 }),
    });
    assert.equal(nested.simpleStruct.long, 1n);
    assert.equal(nested.simpleStruct.int8, 2);
    const inner = nested.simpleStruct;
    inner.long = 55n;
    assert.equal(nested.simpleStruct.long, 55n);
    assert.equal(nested.simpleStruct.int8, 2);
});

test("NestedStruct inline struct field writes copy the donor struct", () => {
    const donor = new GIMarshallingTests.SimpleStruct({ long: 9n, int8: 4 });
    const nested = new GIMarshallingTests.NestedStruct({});
    nested.simpleStruct = donor;
    donor.long = 400n;
    assert.equal(nested.simpleStruct.long, 9n);
    assert.equal(nested.simpleStruct.int8, 4);
});

test("PointerStruct returnv exposes the expected field and passes inv", () => {
    const struct = GIMarshallingTests.PointerStruct.returnv();
    assert.equal(struct.long, 42n);
    struct.inv();
});

test("a pointer registered struct constructs from props", () => {
    const empty = new GIMarshallingTests.PointerStruct({});
    assert.equal(empty.long, 0n);

    const filled = new GIMarshallingTests.PointerStruct({ long: 42n });
    assert.equal(filled.long, 42n);
    filled.inv();

    filled.long = 43n;
    assert.equal(filled.long, 43n);
    assert.equal(GIMarshallingTests.PointerStruct.returnv().long, 42n);
});

test("many pointer registered structs survive collection", async () => {
    for (let index = 0; index < 1000; index += 1) {
        assert.equal(new GIMarshallingTests.PointerStruct({ long: BigInt(index) }).long, BigInt(index));
    }

    await drainGC(5);
});

test("a pointer registered struct rejects field writes it cannot hold", () => {
    assert.throws(() => new GIMarshallingTests.PointerStruct({ long: 1.5 }));
    assert.throws(() => new GIMarshallingTests.PointerStruct({ long: "nope" }));
    const struct = new GIMarshallingTests.PointerStruct({});
    assert.throws(() => {
        struct.long = Symbol("nope");
    });
});

test("Union round trips through returnv, construction, and field writes", () => {
    const returned = GIMarshallingTests.Union.returnv();
    assert.equal(returned.long, 42n);
    returned.inv();
    returned.method();
    const constructed = new GIMarshallingTests.Union({ long: 42n });
    assert.equal(constructed.long, 42n);
    constructed.inv();
    const written = new GIMarshallingTests.Union({});
    written.long = 42n;
    assert.equal(written.long, 42n);
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
        assert.equal(union.type(), type);
    }
});

test("StructuredUnion sub-struct wrappers expose inline parent fields as aliases", () => {
    const sub = new GIMarshallingTests.StructuredUnionSimpleStruct({
        type: GIMarshallingTests.StructuredUnionType.SIMPLE_STRUCT,
        parent: new GIMarshallingTests.SimpleStruct({ long: 6n, int8: 7 }),
    });
    assert.equal(sub.type, GIMarshallingTests.StructuredUnionType.SIMPLE_STRUCT);
    assert.equal(sub.parent.long, 6n);
    assert.equal(sub.parent.int8, 7);
    const parent = sub.parent;
    parent.long = 12n;
    assert.equal(sub.parent.long, 12n);
});

test("TestStructA clone caller-allocates a deep copy", () => {
    const original = new Regress.TestStructA({
        someInt: 10,
        someInt8: 11,
        someDouble: 1.5,
        someEnum: Regress.TestEnum.VALUE2,
    });
    const clone = original.clone();
    assert.equal(clone.someInt, 10);
    assert.equal(clone.someInt8, 11);
    assert.equal(clone.someDouble, 1.5);
    assert.equal(clone.someEnum, Regress.TestEnum.VALUE2);
    original.someInt = 77;
    assert.equal(clone.someInt, 10);
    clone.someInt = 500;
    assert.equal(original.someInt, 77);
});

test("TestStructA parse fills a caller-allocated out struct", () => {
    const parsed = Regress.TestStructA.parse("ignored");
    assert.equal(parsed.someInt, 23);
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
    assert.equal(clone.someInt8, 3);
    assert.equal(clone.nestedA.someInt, 5);
    assert.equal(clone.nestedA.someInt8, 6);
    assert.equal(clone.nestedA.someDouble, 2.5);
    assert.equal(clone.nestedA.someEnum, Regress.TestEnum.VALUE1);
    original.nestedA.someInt = 100;
    assert.equal(clone.nestedA.someInt, 5);
    assert.equal(original.nestedA.someInt, 100);
});

test("TestStructFixedArray frob fills the fixed array field", () => {
    const struct = new Regress.TestStructFixedArray({});
    struct.frob();
    assert.equal(struct.justInt, 7);
    assert.deepEqual(struct.array, [42, 43, 44, 45, 46, 47, 48, 49, 50, 51]);
});

test("a fixed-size array field round-trips exactly its own length", () => {
    const struct = new Regress.TestStructFixedArray({});
    struct.justInt = 5;
    assert.equal(struct.justInt, 5);
    struct.array = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    assert.deepEqual(struct.array, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    const readBack = struct.array;
    struct.array = readBack;
    assert.deepEqual(struct.array, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    assert.equal(struct.justInt, 5);
});

test("a fixed-size array field writes as far as the value reaches", () => {
    const struct = new Regress.TestStructFixedArray({});
    struct.array = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

    struct.array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    assert.deepEqual(struct.array, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    struct.array = [9, 8];
    assert.deepEqual(struct.array, [9, 8, 3, 4, 5, 6, 7, 8, 9, 10]);

    struct.array = [];
    assert.deepEqual(struct.array, [9, 8, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("the fixed-size argument path rejects the same length mismatch", () => {
    GIMarshallingTests.arrayFixedIntIn([-1, 0, 1, 2]);

    assert.throws(() => GIMarshallingTests.arrayFixedIntIn([-1, 0, 1]));
    assert.throws(() => GIMarshallingTests.arrayFixedIntIn([-1, 0, 1, 2, 3]));
});

test("foo unions read back the member that was written", () => {
    const boxedUnion = Regress.FooBUnion.new();
    assert.equal(boxedUnion.type, 0);
    assert.equal(boxedUnion.v, 0);
    boxedUnion.type = 13;
    assert.equal(boxedUnion.type, 13);
    boxedUnion.v = 2.75;
    assert.equal(boxedUnion.v, 2.75);
    const plainUnion = new Regress.FooUnion({ regressFoo: 5 });
    assert.equal(plainUnion.regressFoo, 5);
    plainUnion.regressFoo = 9;
    assert.equal(plainUnion.regressFoo, 9);
});

test("plain object literals are rejected where a struct is expected", () => {
    assert.throws(() => new GIMarshallingTests.NestedStruct({ simpleStruct: { long: 3n, int8: 4 } }));
    const nested = new GIMarshallingTests.NestedStruct({});
    assert.throws(() => {
        nested.simpleStruct = { long: 9n, int8: 1 };
    });
    assert.throws(() => GIMarshallingTests.SimpleStruct.prototype.inv.call({ long: 6n, int8: 7 }));
});

test("null is rejected for inline struct fields", () => {
    assert.throws(() => new GIMarshallingTests.NestedStruct({ simpleStruct: null }));
    const nested = new GIMarshallingTests.NestedStruct({});
    assert.throws(() => {
        nested.simpleStruct = null;
    });
});

test("struct field writes reject out-of-range and mistyped values", () => {
    const simple = new GIMarshallingTests.SimpleStruct({});
    assert.throws(() => {
        simple.int8 = 128;
    });
    assert.throws(() => {
        simple.int8 = -129;
    });
    assert.throws(() => {
        simple.int8 = Symbol("nope");
    });
    assert.throws(() => {
        simple.long = 1.5;
    });
    assert.throws(() => new GIMarshallingTests.SimpleStruct({ long: "nope" }));
    const structA = new Regress.TestStructA({});
    assert.throws(() => {
        structA.someEnum = 12_345;
    });
});

test("abstract structs and unions cannot be constructed", () => {
    assert.throws(() => new GIMarshallingTests.NotSimpleStruct());
    assert.throws(() => new GIMarshallingTests.UnregisteredUnion());
    assert.throws(() => new Regress.TestStructC());
    assert.throws(() => new Regress.TestStructD());
    assert.throws(() => new Regress.TestStructE());
    assert.throws(() => new Regress.TestStructF());
});

test("a struct method whose C symbol is missing throws", () => {
    const union = Regress.FooBUnion.new();
    assert.throws(() => union.getContainedType());
});

test("callables that pass or return a record by value are not bound at all", () => {
    assert.equal(GIMarshallingTests.gvalueFlatArrayRoundTrip, undefined);
    assert.equal(Regress.fooMethodExternalReferences, undefined);
});

test("records GIR spells without a star but that are really pointers still bind", () => {
    const bytes = GLib.Bytes.new([1, 2, 3]);
    assert.equal(bytes.equal(GLib.Bytes.new([1, 2, 3])), true);
    assert.equal(bytes.equal(GLib.Bytes.new([1, 2, 4])), false);
    assert.equal(bytes.compare(GLib.Bytes.new([1, 2, 3])), 0);
    assert.equal(typeof HarfBuzz.ftFontCreateReferenced, "function");
    assert.equal(typeof HarfBuzz.ftFaceCreateReferenced, "function");
});
