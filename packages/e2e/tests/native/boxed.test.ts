import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Pango from "@gtkx/gi/pango";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { drainAfterEachTest, drainGC } from "./helpers/memory.js";

drainAfterEachTest();

test("boxed struct constructs with defaults and props", () => {
    const empty = new GIMarshallingTests.BoxedStruct({});
    expect(empty.long).toBe(0n);
    expect(empty.string).toBeNull();
    const fresh = GIMarshallingTests.BoxedStruct.new();
    expect(fresh.long).toBe(0n);
    expect(fresh.string).toBeNull();
    const filled = new GIMarshallingTests.BoxedStruct({ long: 42n, string: "hi" });
    expect(filled.long).toBe(42n);
    expect(filled.string).toBe("hi");
    filled.inv();
});

test("boxed struct long field accepts plain numbers", () => {
    // @ts-expect-error the long field is declared bigint, and the binding widens it to a plain number
    const s = new GIMarshallingTests.BoxedStruct({ long: 42 });
    expect(s.long).toBe(42n);
    s.inv();
    // @ts-expect-error the long field is declared bigint, and the binding widens it to a plain number
    s.long = 43;
    expect(s.long).toBe(43n);
});

test("boxed struct returnv and out marshal the C values", () => {
    const returned = GIMarshallingTests.BoxedStruct.returnv();
    expect(returned.long).toBe(42n);
    expect(returned.string).toBe("hello");
    const out = GIMarshallingTests.BoxedStruct.out();
    expect(out.long).toBe(42n);
    expect(out.string).toBeNull();
});

test("borrowed boxed returns decode as independent copies", () => {
    const first = GIMarshallingTests.BoxedStruct.returnv();
    const second = GIMarshallingTests.BoxedStruct.returnv();
    expect(first.long).toBe(second.long);
    expect(first.string).toBe(second.string);
    first.long = 99n;
    expect(second.long).toBe(42n);
    expect(GIMarshallingTests.BoxedStruct.returnv().long).toBe(42n);
    const outA = GIMarshallingTests.BoxedStruct.out();
    const outB = GIMarshallingTests.BoxedStruct.out();
    outA.long = 7n;
    expect(outB.long).toBe(42n);
    expect(GIMarshallingTests.BoxedStruct.out().long).toBe(42n);
});

test("boxed struct uninitialized out reports failure with null", () => {
    expect(GIMarshallingTests.BoxedStruct.outUninitialized()).toEqual([false, null]);
});

test("boxed constructors produce the documented values", () => {
    expect(Regress.TestBoxed.new().someInt8).toBe(0);
    expect(Regress.TestBoxed.newAlternativeConstructor1(5).someInt8).toBe(5);
    expect(Regress.TestBoxed.newAlternativeConstructor2(1, 2).someInt8).toBe(3);
    expect(Regress.TestBoxed.newAlternativeConstructor3("42").someInt8).toBe(42);
});

test("boxed equals compares int8 and nested struct", () => {
    const a = Regress.TestBoxed.new();
    const b = Regress.TestBoxed.new();
    expect(a.equals(b)).toBe(true);
    a.someInt8 = 5;
    expect(a.equals(b)).toBe(false);
    b.someInt8 = 5;
    expect(a.equals(b)).toBe(true);
    a.nestedA = new Regress.TestSimpleBoxedA({ someInt: 1, someInt8: 2, someDouble: 3 });
    expect(a.equals(b)).toBe(false);
    b.nestedA = new Regress.TestSimpleBoxedA({ someInt: 1, someInt8: 2, someDouble: 3 });
    expect(a.equals(b)).toBe(true);
});

test("boxed copy is independent of its source", () => {
    const source = Regress.TestBoxed.newAlternativeConstructor1(9);
    const copy = source.copy();
    expect(copy.someInt8).toBe(9);
    expect(copy.equals(source)).toBe(true);
    copy.someInt8 = 10;
    expect(source.someInt8).toBe(9);
    expect(copy.equals(source)).toBe(false);
});

test("boxed exposes nested and private struct fields", () => {
    const boxed = Regress.TestBoxed.new();
    expect(boxed.nestedA instanceof Regress.TestSimpleBoxedA).toBeTruthy();
    expect(boxed.nestedA.someInt).toBe(0);
    expect(boxed.priv instanceof Regress.TestBoxedPrivate).toBeTruthy();
    const nested = new Regress.TestSimpleBoxedA({ someInt: 4, someInt8: 5, someDouble: 6 });
    boxed.nestedA = nested;
    nested.someInt = 100;
    expect(boxed.nestedA.someInt).toBe(4);
    expect(boxed.nestedA.someInt8).toBe(5);
    expect(boxed.nestedA.someDouble).toBe(6);
});

test("boxed non-method helpers accept the boxed", () => {
    const boxed = Regress.TestBoxed.newAlternativeConstructor1(9);
    boxed.notAMethod();
    Regress.testBoxedsNotAMethod(boxed);
    Regress.testBoxedsNotAStatic();
    expect(boxed.someInt8).toBe(9);
    expect(boxed.equals(Regress.TestBoxed.newAlternativeConstructor1(9))).toBe(true);
});

test("simple boxed a const return decodes as a copy", () => {
    const a = Regress.TestSimpleBoxedA.constReturn();
    expect(a.someInt).toBe(5);
    expect(a.someInt8).toBe(6);
    expect(a.someDouble).toBe(7);
    expect(a.someEnum).toBe(Regress.TestEnum.VALUE1);
    a.someInt = 99;
    expect(Regress.TestSimpleBoxedA.constReturn().someInt).toBe(5);
});

test("simple boxed a equals and copy follow the C semantics", () => {
    const built = new Regress.TestSimpleBoxedA({ someInt: 5, someInt8: 6, someDouble: 7 });
    expect(built.equals(Regress.TestSimpleBoxedA.constReturn())).toBe(true);
    const copy = built.copy();
    expect(copy.equals(built)).toBe(true);
    copy.someDouble = 8;
    expect(built.someDouble).toBe(7);
    expect(copy.equals(built)).toBe(false);
});

test("simple boxed b carries an inline nested a", () => {
    const b = new Regress.TestSimpleBoxedB({ someInt8: 3 });
    expect(b.someInt8).toBe(3);
    b.nestedA = new Regress.TestSimpleBoxedA({ someInt: 1, someInt8: 2, someDouble: 3 });
    expect(b.nestedA.someInt).toBe(1);
    const copy = b.copy();
    expect(copy.someInt8).toBe(3);
    expect(copy.nestedA.someInt).toBe(1);
    copy.someInt8 = 4;
    expect(b.someInt8).toBe(3);
});

test("boxed b round trips int8 and long fields", () => {
    const b = Regress.TestBoxedB.new(7, 5n);
    expect(b.someInt8).toBe(7);
    expect(b.someLong).toBe(5n);
    const built = new Regress.TestBoxedB({ someInt8: 1, someLong: 2n });
    expect(built.someInt8).toBe(1);
    expect(built.someLong).toBe(2n);
    const copy = b.copy();
    expect(copy.someInt8).toBe(7);
    expect(copy.someLong).toBe(5n);
    copy.someLong = 6n;
    expect(b.someLong).toBe(5n);
});

test("refcounted boxed c is adopted on full transfer", () => {
    const c = Regress.TestBoxedC.new();
    expect(c.refcount).toBe(1);
    expect(c.anotherThing).toBe(42);
    const built = new Regress.TestBoxedC({ nameConflict: true });
    expect(built.nameConflict()).toBe(true);
    expect(built.refcount).toBe(1);
    expect(built.anotherThing).toBe(42);
});

test("refcounted boxed c is referenced on borrowed decode", () => {
    const wrapper = Regress.TestBoxedCWrapper.new();
    const inner = wrapper.get();
    expect(inner.refcount).toBe(2);
    expect(inner.anotherThing).toBe(42);
    const copy = wrapper.copy();
    const innerOfCopy = copy.get();
    expect(innerOfCopy.refcount).toBe(4);
    expect(innerOfCopy.anotherThing).toBe(42);
});

test("boxed d computes magic and copies deeply", () => {
    const d = Regress.TestBoxedD.new("abcd", 8);
    expect(d.getMagic()).toBe(12);
    const copy = d.copy();
    expect(copy.getMagic()).toBe(12);
    expect(Regress.TestBoxedD.new("", 0).getMagic()).toBe(0);
});

test("gvariant returns round trip their contents", () => {
    const i = Regress.testGvariantI();
    expect(i.getInt32()).toBe(1);
    expect(i.getTypeString()).toBe("i");
    expect(i.equal(Regress.testGvariantI())).toBe(true);
    const s = Regress.testGvariantS();
    expect(s.getString()).toEqual(["one", 3]);
    const v = Regress.testGvariantV();
    expect(v.getVariant().getString()).toEqual(["contents", 8]);
    expect(Regress.testGvariantAs().getStrv()).toEqual(["one", "two", "three"]);
});

test("gvariant asv dictionary looks up its entries", () => {
    const asv = Regress.testGvariantAsv();
    expect(asv.getTypeString()).toBe("a{sv}");
    expect(asv.nChildren()).toBe(2);
    expect(asv.lookupValue("name", null).getString()).toEqual(["foo", 3]);
    expect(asv.lookupValue("timeout", null).getInt32()).toBe(10);
});

test("param specs marshal in and out as fundamentals", () => {
    const spec = GObject.paramSpecBoolean("mybool", null, null, false, GObject.ParamFlags.READABLE);
    GIMarshallingTests.paramSpecInBool(spec);
    const returned = GIMarshallingTests.paramSpecReturn();
    expect(returned.getName()).toBe("test-param");
    expect(returned.getNick()).toBe("test");
    expect(returned.getBlurb()).toBe("This is a test");
    const out = GIMarshallingTests.paramSpecOut();
    expect(out.getName()).toBe("test-param");
    expect(GIMarshallingTests.paramSpecOutUninitialized()).toEqual([false, null]);
});

test("boxed arguments reject wrong JS types", () => {
    expect(() => {
        // @ts-expect-error a plain object is not a TestBoxed
        Regress.testBoxedsNotAMethod({});
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not a TestBoxed
        Regress.testBoxedsNotAMethod("boxed");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a TestBoxed
        Regress.testBoxedsNotAMethod(42);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not a TestBoxed
        Regress.testBoxedsNotAMethod(Symbol("boxed"));
    }).toThrow();
    const boxed = Regress.TestBoxed.new();
    // @ts-expect-error a plain object is not a TestBoxed
    expect(() => boxed.equals({})).toThrow();
    // @ts-expect-error the compared boxed is not nullable
    expect(() => boxed.equals(null)).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a ParamSpec
        GIMarshallingTests.paramSpecInBool({});
    }).toThrow();
});

test("a boxed with C invariants is built by its own constructor", () => {
    const boxed = new Regress.TestBoxed({ someInt8: 7 });
    expect(boxed.someInt8).toBe(7);
    expect(boxed.priv instanceof Regress.TestBoxedPrivate).toBeTruthy();

    const copy = boxed.copy();
    expect(copy.someInt8).toBe(7);
    expect(boxed.equals(copy)).toBe(true);
    boxed.notAMethod();

    expect(new Regress.TestBoxed({}).someInt8).toBe(Regress.TestBoxed.new().someInt8);
    expect(new Regress.TestBoxedC({}).anotherThing).toBe(Regress.TestBoxedC.new().anotherThing);
    expect(new GIMarshallingTests.BoxedStruct({}).long).toBe(GIMarshallingTests.BoxedStruct.new().long);
});

test("many boxed instances with C invariants survive collection", async () => {
    for (let index = 0; index < 500; index += 1) {
        expect(new Regress.TestBoxed({ someInt8: index % 128 }).someInt8).toBe(index % 128);
        expect(new Regress.TestBoxedC({}).refcount).toBe(1);
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

    expect(built).toHaveLength(11);
    built.length = 0;
    await drainGC(5);
});

test("a boxed argument rejects a value of an unrelated boxed type", () => {
    Regress.testBoxedsNotAMethod(Regress.TestBoxed.new());

    expect(() => {
        // @ts-expect-error a BoxedStruct is not a TestBoxed
        Regress.testBoxedsNotAMethod(new GIMarshallingTests.BoxedStruct({ long: 42n }));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a TestBoxedB is not a TestBoxed
        Regress.testBoxedsNotAMethod(Regress.TestBoxedB.new(1, 2n));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a TestObj is not a TestBoxed
        Regress.testBoxedsNotAMethod(new Regress.TestObj({}));
    }).toThrow();
});

test("a boxed field rejects a value of an unrelated boxed type", () => {
    const boxed = Regress.TestBoxed.new();
    boxed.nestedA = new Regress.TestSimpleBoxedA({ someInt: 4, someInt8: 5, someDouble: 6 });
    expect(boxed.nestedA.someInt).toBe(4);

    expect(() => {
        // @ts-expect-error a BoxedStruct is not a TestSimpleBoxedA
        boxed.nestedA = new GIMarshallingTests.BoxedStruct({ long: 42n });
    }).toThrow();
    expect(boxed.nestedA.someInt).toBe(4);
});

test("boxed field writes reject invalid values", () => {
    // @ts-expect-error a string is not a long field value
    expect(() => new GIMarshallingTests.BoxedStruct({ long: "x" })).toThrow();
    // @ts-expect-error a fractional number is not a long field value
    expect(() => new GIMarshallingTests.BoxedStruct({ long: 1.5 })).toThrow();
    const s = new GIMarshallingTests.BoxedStruct({});
    expect(() => {
        // @ts-expect-error a fractional number is not a long field value
        s.long = 1.5;
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a string field value
        s.string = 42;
    }).toThrow();
    // @ts-expect-error a string is not an int8 argument
    expect(() => Regress.TestBoxedB.new("x", 1n)).toThrow();
    expect(() => Regress.TestBoxedB.new(128, 1n)).toThrow();
});
