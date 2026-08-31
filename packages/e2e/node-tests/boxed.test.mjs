import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Pango from "@gtkx/gi/pango";
import * as Regress from "@gtkx/gi/regress";
import assert from "node:assert/strict";
import { test } from "node:test";
import { drainAfterEachTest, drainGC } from "./helpers/memory.mjs";

drainAfterEachTest();

test("boxed struct constructs with defaults and props", () => {
    const empty = new GIMarshallingTests.BoxedStruct({});
    assert.equal(empty.long, 0n);
    assert.equal(empty.string, null);
    const fresh = GIMarshallingTests.BoxedStruct.new();
    assert.equal(fresh.long, 0n);
    assert.equal(fresh.string, null);
    const filled = new GIMarshallingTests.BoxedStruct({ long: 42n, string: "hi" });
    assert.equal(filled.long, 42n);
    assert.equal(filled.string, "hi");
    filled.inv();
});

test("boxed struct long field accepts plain numbers", () => {
    const s = new GIMarshallingTests.BoxedStruct({ long: 42 });
    assert.equal(s.long, 42n);
    s.inv();
    s.long = 43;
    assert.equal(s.long, 43n);
});

test("boxed struct returnv and out marshal the C values", () => {
    const returned = GIMarshallingTests.BoxedStruct.returnv();
    assert.equal(returned.long, 42n);
    assert.equal(returned.string, "hello");
    const out = GIMarshallingTests.BoxedStruct.out();
    assert.equal(out.long, 42n);
    assert.equal(out.string, null);
});

test("borrowed boxed returns decode as independent copies", () => {
    const first = GIMarshallingTests.BoxedStruct.returnv();
    const second = GIMarshallingTests.BoxedStruct.returnv();
    assert.equal(first.long, second.long);
    assert.equal(first.string, second.string);
    first.long = 99n;
    assert.equal(second.long, 42n);
    assert.equal(GIMarshallingTests.BoxedStruct.returnv().long, 42n);
    const outA = GIMarshallingTests.BoxedStruct.out();
    const outB = GIMarshallingTests.BoxedStruct.out();
    outA.long = 7n;
    assert.equal(outB.long, 42n);
    assert.equal(GIMarshallingTests.BoxedStruct.out().long, 42n);
});

test("boxed struct uninitialized out reports failure with null", () => {
    assert.deepEqual(GIMarshallingTests.BoxedStruct.outUninitialized(), [false, null]);
});

test("test boxed constructors produce the documented values", () => {
    assert.equal(Regress.TestBoxed.new().someInt8, 0);
    assert.equal(Regress.TestBoxed.newAlternativeConstructor1(5).someInt8, 5);
    assert.equal(Regress.TestBoxed.newAlternativeConstructor2(1, 2).someInt8, 3);
    assert.equal(Regress.TestBoxed.newAlternativeConstructor3("42").someInt8, 42);
});

test("test boxed equals compares int8 and nested struct", () => {
    const a = Regress.TestBoxed.new();
    const b = Regress.TestBoxed.new();
    assert.equal(a.equals(b), true);
    a.someInt8 = 5;
    assert.equal(a.equals(b), false);
    b.someInt8 = 5;
    assert.equal(a.equals(b), true);
    a.nestedA = new Regress.TestSimpleBoxedA({ someInt: 1, someInt8: 2, someDouble: 3 });
    assert.equal(a.equals(b), false);
    b.nestedA = new Regress.TestSimpleBoxedA({ someInt: 1, someInt8: 2, someDouble: 3 });
    assert.equal(a.equals(b), true);
});

test("test boxed copy is independent of its source", () => {
    const source = Regress.TestBoxed.newAlternativeConstructor1(9);
    const copy = source.copy();
    assert.equal(copy.someInt8, 9);
    assert.equal(copy.equals(source), true);
    copy.someInt8 = 10;
    assert.equal(source.someInt8, 9);
    assert.equal(copy.equals(source), false);
});

test("test boxed exposes nested and private struct fields", () => {
    const boxed = Regress.TestBoxed.new();
    assert.ok(boxed.nestedA instanceof Regress.TestSimpleBoxedA);
    assert.equal(boxed.nestedA.someInt, 0);
    assert.ok(boxed.priv instanceof Regress.TestBoxedPrivate);
    const nested = new Regress.TestSimpleBoxedA({ someInt: 4, someInt8: 5, someDouble: 6 });
    boxed.nestedA = nested;
    nested.someInt = 100;
    assert.equal(boxed.nestedA.someInt, 4);
    assert.equal(boxed.nestedA.someInt8, 5);
    assert.equal(boxed.nestedA.someDouble, 6);
});

test("test boxed non-method helpers accept the boxed", () => {
    const boxed = Regress.TestBoxed.newAlternativeConstructor1(9);
    boxed.notAMethod();
    Regress.testBoxedsNotAMethod(boxed);
    Regress.testBoxedsNotAStatic();
    assert.equal(boxed.someInt8, 9);
    assert.equal(boxed.equals(Regress.TestBoxed.newAlternativeConstructor1(9)), true);
});

test("simple boxed a const return decodes as a copy", () => {
    const a = Regress.TestSimpleBoxedA.constReturn();
    assert.equal(a.someInt, 5);
    assert.equal(a.someInt8, 6);
    assert.equal(a.someDouble, 7);
    assert.equal(a.someEnum, Regress.TestEnum.VALUE1);
    a.someInt = 99;
    assert.equal(Regress.TestSimpleBoxedA.constReturn().someInt, 5);
});

test("simple boxed a equals and copy follow the C semantics", () => {
    const built = new Regress.TestSimpleBoxedA({ someInt: 5, someInt8: 6, someDouble: 7 });
    assert.equal(built.equals(Regress.TestSimpleBoxedA.constReturn()), true);
    const copy = built.copy();
    assert.equal(copy.equals(built), true);
    copy.someDouble = 8;
    assert.equal(built.someDouble, 7);
    assert.equal(copy.equals(built), false);
});

test("simple boxed b carries an inline nested a", () => {
    const b = new Regress.TestSimpleBoxedB({ someInt8: 3 });
    assert.equal(b.someInt8, 3);
    b.nestedA = new Regress.TestSimpleBoxedA({ someInt: 1, someInt8: 2, someDouble: 3 });
    assert.equal(b.nestedA.someInt, 1);
    const copy = b.copy();
    assert.equal(copy.someInt8, 3);
    assert.equal(copy.nestedA.someInt, 1);
    copy.someInt8 = 4;
    assert.equal(b.someInt8, 3);
});

test("test boxed b round trips int8 and long fields", () => {
    const b = Regress.TestBoxedB.new(7, 5n);
    assert.equal(b.someInt8, 7);
    assert.equal(b.someLong, 5n);
    const built = new Regress.TestBoxedB({ someInt8: 1, someLong: 2n });
    assert.equal(built.someInt8, 1);
    assert.equal(built.someLong, 2n);
    const copy = b.copy();
    assert.equal(copy.someInt8, 7);
    assert.equal(copy.someLong, 5n);
    copy.someLong = 6n;
    assert.equal(b.someLong, 5n);
});

test("refcounted boxed c is adopted on full transfer", () => {
    const c = Regress.TestBoxedC.new();
    assert.equal(c.refcount, 1);
    assert.equal(c.anotherThing, 42);
    const built = new Regress.TestBoxedC({ nameConflict: true });
    assert.equal(built.nameConflict(), true);
    assert.equal(built.refcount, 1);
    assert.equal(built.anotherThing, 42);
});

test("refcounted boxed c is referenced on borrowed decode", () => {
    const wrapper = Regress.TestBoxedCWrapper.new();
    const inner = wrapper.get();
    assert.equal(inner.refcount, 2);
    assert.equal(inner.anotherThing, 42);
    const copy = wrapper.copy();
    const innerOfCopy = copy.get();
    assert.equal(innerOfCopy.refcount, 4);
    assert.equal(innerOfCopy.anotherThing, 42);
});

test("test boxed d computes magic and copies deeply", () => {
    const d = Regress.TestBoxedD.new("abcd", 8);
    assert.equal(d.getMagic(), 12);
    const copy = d.copy();
    assert.equal(copy.getMagic(), 12);
    assert.equal(Regress.TestBoxedD.new("", 0).getMagic(), 0);
});

test("gvariant returns round trip their contents", () => {
    const i = Regress.testGvariantI();
    assert.equal(i.getInt32(), 1);
    assert.equal(i.getTypeString(), "i");
    assert.equal(i.equal(Regress.testGvariantI()), true);
    const s = Regress.testGvariantS();
    assert.deepEqual(s.getString(), ["one", 3]);
    const v = Regress.testGvariantV();
    assert.deepEqual(v.getVariant().getString(), ["contents", 8]);
    assert.deepEqual(Regress.testGvariantAs().getStrv(), ["one", "two", "three"]);
});

test("gvariant asv dictionary looks up its entries", () => {
    const asv = Regress.testGvariantAsv();
    assert.equal(asv.getTypeString(), "a{sv}");
    assert.equal(asv.nChildren(), 2);
    assert.deepEqual(asv.lookupValue("name", null).getString(), ["foo", 3]);
    assert.equal(asv.lookupValue("timeout", null).getInt32(), 10);
});

test("param specs marshal in and out as fundamentals", () => {
    const spec = GObject.paramSpecBoolean("mybool", null, null, false, GObject.ParamFlags.READABLE);
    GIMarshallingTests.paramSpecInBool(spec);
    const returned = GIMarshallingTests.paramSpecReturn();
    assert.equal(returned.getName(), "test-param");
    assert.equal(returned.getNick(), "test");
    assert.equal(returned.getBlurb(), "This is a test");
    const out = GIMarshallingTests.paramSpecOut();
    assert.equal(out.getName(), "test-param");
    assert.deepEqual(GIMarshallingTests.paramSpecOutUninitialized(), [false, null]);
});

test("boxed arguments reject wrong JS types", () => {
    assert.throws(() => Regress.testBoxedsNotAMethod({}));
    assert.throws(() => Regress.testBoxedsNotAMethod("boxed"));
    assert.throws(() => Regress.testBoxedsNotAMethod(42));
    assert.throws(() => Regress.testBoxedsNotAMethod(Symbol("boxed")));
    const boxed = Regress.TestBoxed.new();
    assert.throws(() => boxed.equals({}));
    assert.throws(() => boxed.equals(null));
    assert.throws(() => GIMarshallingTests.paramSpecInBool({}));
});

test("a boxed with C invariants is built by its own constructor", () => {
    const boxed = new Regress.TestBoxed({ someInt8: 7 });
    assert.equal(boxed.someInt8, 7);
    assert.ok(boxed.priv instanceof Regress.TestBoxedPrivate);

    const copy = boxed.copy();
    assert.equal(copy.someInt8, 7);
    assert.equal(boxed.equals(copy), true);
    boxed.notAMethod();

    assert.equal(new Regress.TestBoxed({}).someInt8, Regress.TestBoxed.new().someInt8);
    assert.equal(new Regress.TestBoxedC({}).anotherThing, Regress.TestBoxedC.new().anotherThing);
    assert.equal(new GIMarshallingTests.BoxedStruct({}).long, GIMarshallingTests.BoxedStruct.new().long);
});

test("many boxed instances with C invariants survive collection", async () => {
    for (let index = 0; index < 500; index += 1) {
        assert.equal(new Regress.TestBoxed({ someInt8: index % 128 }).someInt8, index % 128);
        assert.equal(new Regress.TestBoxedC({}).refcount, 1);
    }

    await drainGC(5);
});

test("records whose boxed free is a real destructor are safe to construct", async () => {
    const built = [
        new GLib.Array({}),
        new GLib.ByteArray({}),
        new GLib.PtrArray({}),
        new GLib.Thread({}),
        new GLib.Source({}),
        new GLib.VariantBuilder({}),
        new GLib.VariantDict({}),
        new GObject.Closure({}),
        new Pango.Attribute({}),
        new Pango.FontMetrics({}),
        new Pango.LayoutLine({}),
    ];

    assert.equal(built.length, 11);
    built.length = 0;
    await drainGC(5);
});

test("a boxed argument rejects a value of an unrelated boxed type", () => {
    Regress.testBoxedsNotAMethod(Regress.TestBoxed.new());

    assert.throws(() => Regress.testBoxedsNotAMethod(new GIMarshallingTests.BoxedStruct({ long: 42n })));
    assert.throws(() => Regress.testBoxedsNotAMethod(Regress.TestBoxedB.new(1, 2n)));
});

test("a boxed field rejects a value of an unrelated boxed type", () => {
    const boxed = Regress.TestBoxed.new();
    boxed.nestedA = new Regress.TestSimpleBoxedA({ someInt: 4, someInt8: 5, someDouble: 6 });
    assert.equal(boxed.nestedA.someInt, 4);

    assert.throws(() => {
        boxed.nestedA = new GIMarshallingTests.BoxedStruct({ long: 42n });
    });
    assert.equal(boxed.nestedA.someInt, 4);
});

test("boxed field writes reject invalid values", () => {
    assert.throws(() => new GIMarshallingTests.BoxedStruct({ long: "x" }));
    assert.throws(() => new GIMarshallingTests.BoxedStruct({ long: 1.5 }));
    const s = new GIMarshallingTests.BoxedStruct({});
    assert.throws(() => {
        s.long = 1.5;
    });
    assert.throws(() => {
        s.string = 42;
    });
    assert.throws(() => Regress.TestBoxedB.new("x", 1n));
    assert.throws(() => Regress.TestBoxedB.new(128, 1n));
});
