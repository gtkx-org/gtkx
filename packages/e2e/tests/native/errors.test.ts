import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import * as WarnLib from "@gtkx/gi/warnlib";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const marshallingDomain = () => GLib.quarkFromString(GIMarshallingTests.CONSTANT_GERROR_DOMAIN);
const ioDomain = () => GLib.quarkFromString("g-io-error-quark");

test("a failing call throws", () => {
    expect(() => {
        GIMarshallingTests.gerror();
    }).toThrow();
});

test("a call that throws after marshalling its array reports the same error", () => {
    expect(() => {
        GIMarshallingTests.gerrorArrayIn([-1, 0, 1, 2]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.gerrorArrayIn([]);
    }).toThrow();
});

test("a gerror declared as an out parameter is returned instead of thrown", () => {
    const [error, debug] = GIMarshallingTests.gerrorOut();
    expect(error instanceof GLib.Error).toBeTruthy();
    expect(error.domain).toBe(marshallingDomain());
    expect(error.code).toBe(GIMarshallingTests.CONSTANT_GERROR_CODE);
    expect(error.message).toBe(GIMarshallingTests.CONSTANT_GERROR_MESSAGE);
    expect(debug).toBe(GIMarshallingTests.CONSTANT_GERROR_DEBUG_MESSAGE);

    const [other] = GIMarshallingTests.gerrorOut();
    expect(other).not.toBe(error);
    error.code = 7;
    expect(other.code).toBe(GIMarshallingTests.CONSTANT_GERROR_CODE);
    expect(GIMarshallingTests.gerrorOut()[0].code).toBe(GIMarshallingTests.CONSTANT_GERROR_CODE);
});

test("a transfer none gerror out parameter decodes as an independent copy", () => {
    const [error, debug] = GIMarshallingTests.gerrorOutTransferNone();
    expect(error instanceof GLib.Error).toBeTruthy();
    expect(error.domain).toBe(marshallingDomain());
    expect(error.code).toBe(GIMarshallingTests.CONSTANT_GERROR_CODE);
    expect(error.message).toBe(GIMarshallingTests.CONSTANT_GERROR_MESSAGE);
    expect(debug).toBe(GIMarshallingTests.CONSTANT_GERROR_DEBUG_MESSAGE);

    error.code = 99;
    const [second, secondDebug] = GIMarshallingTests.gerrorOutTransferNone();
    expect(second).not.toBe(error);
    expect(second.code).toBe(GIMarshallingTests.CONSTANT_GERROR_CODE);
    expect(secondDebug).toBe(GIMarshallingTests.CONSTANT_GERROR_DEBUG_MESSAGE);
});

test("uninitialized gerror out parameters report failure with nulls", () => {
    expect(GIMarshallingTests.gerrorOutUninitialized()).toEqual([false, null, null]);
    expect(GIMarshallingTests.gerrorOutTransferNoneUninitialized()).toEqual([false, null, null]);
});

test("a returned gerror is an owned value with working error methods", () => {
    const error = GIMarshallingTests.gerrorReturn();
    expect(error instanceof GLib.Error).toBeTruthy();
    expect(error instanceof Error).toBeTruthy();
    expect(error.domain).toBe(marshallingDomain());
    expect(error.code).toBe(GIMarshallingTests.CONSTANT_GERROR_CODE);
    expect(error.message).toBe(GIMarshallingTests.CONSTANT_GERROR_MESSAGE);

    expect(error.matches(marshallingDomain(), GIMarshallingTests.CONSTANT_GERROR_CODE)).toBe(true);
    expect(error.matches(marshallingDomain(), 6)).toBe(false);
    expect(error.matches(ioDomain(), GIMarshallingTests.CONSTANT_GERROR_CODE)).toBe(false);

    const copy = error.copy();
    expect(copy.code).toBe(GIMarshallingTests.CONSTANT_GERROR_CODE);
    expect(copy.message).toBe(GIMarshallingTests.CONSTANT_GERROR_MESSAGE);
    copy.code = 11;
    expect(error.code).toBe(GIMarshallingTests.CONSTANT_GERROR_CODE);
    expect(GIMarshallingTests.gerrorReturn()).not.toBe(error);
});

test("a constructor that fails throws instead of returning an instance", () => {
    expect(() => GIMarshallingTests.Object.newFail(42)).toThrow();
    expect(GIMarshallingTests.Object.new(42).int).toBe(42);
});

test("glib errors round trip the fields they are constructed with", () => {
    const literal = GLib.Error.newLiteral(ioDomain(), Gio.IOErrorEnum.NOT_FOUND, "not found here");
    expect(literal.domain).toBe(ioDomain());
    expect(literal.code).toBe(Gio.IOErrorEnum.NOT_FOUND);
    expect(literal.message).toBe("not found here");

    literal.code = Gio.IOErrorEnum.EXISTS;
    expect(literal.code).toBe(Gio.IOErrorEnum.EXISTS);
    expect(literal.message).toBe("not found here");
    expect(literal.matches(ioDomain(), Gio.IOErrorEnum.EXISTS)).toBe(true);

    const built = new GLib.Error({ domain: ioDomain(), code: Gio.IOErrorEnum.BUSY, message: "busy" });
    expect(built.domain).toBe(ioDomain());
    expect(built.code).toBe(Gio.IOErrorEnum.BUSY);
    expect(built.message).toBe("busy");
    expect(built.matches(ioDomain(), Gio.IOErrorEnum.BUSY)).toBe(true);
});

test("a nullable gerror argument accepts null and an owned error", () => {
    expect(GIMarshallingTests.nullableGerror(null)).toBe(false);
    expect(GIMarshallingTests.nullableGerror(GIMarshallingTests.gerrorReturn())).toBe(true);
    const boom = GLib.Error.newLiteral(ioDomain(), Gio.IOErrorEnum.FAILED, "boom");
    expect(GIMarshallingTests.nullableGerror(boom)).toBe(true);
});

test("errors travel through gvalues as boxed payloads", () => {
    const boxedError = () => {
        const value = new GObject.Value();
        value.init(GLib.Error);
        value.setBoxed(GIMarshallingTests.gerrorReturn());

        return value;
    };

    const value = boxedError();
    const back = value.getBoxed<GLib.Error>();
    expect(back instanceof GLib.Error).toBeTruthy();
    expect(back.domain).toBe(marshallingDomain());
    expect(back.code).toBe(GIMarshallingTests.CONSTANT_GERROR_CODE);
    expect(back.message).toBe(GIMarshallingTests.CONSTANT_GERROR_MESSAGE);

    GIMarshallingTests.compareTwoGerrorsInGvalue(value, boxedError());
});

test("regress calls with a trailing gerror return their values when they succeed", () => {
    expect(Regress.testTortureSignature1(42, "foo", 6)).toEqual([true, 42, 84, 9]);

    const obj = new Regress.TestObj({});
    expect(obj.skipParam(1, 2.5, 3, 4, 5)).toEqual([true, 2, 4, 54]);
    expect(obj.skipOutParam(1, 2.5, 3, 4, 5)).toEqual([true, 2, 4, 54]);
    expect(obj.skipInoutParam(1, 2.5, 3, 4, 5)).toEqual([true, 2, 4, 54]);
    expect(obj.skipReturnVal(1, 2.5, 3, 4, 5)).toEqual([2, 4, 54]);
    const skipReturnValNoOut: (a: number) => unknown = obj.skipReturnValNoOut.bind(obj);

    expect(skipReturnValNoOut(1)).toBeUndefined();

    const fromFile = Regress.TestObj.newFromFile("/anything");
    expect(fromFile instanceof Regress.TestObj).toBeTruthy();
    expect(fromFile.int).toBe(0);
});

test("regress calls with a trailing gerror throw the io error they set", () => {
    expect(() => Regress.testTortureSignature1(42, "foo", 7)).toThrow();
    expect(() => {
        new Regress.TestObj({}).skipReturnValNoOut(0);
    }).toThrow();
});

test("an unregistered error domain still throws a wrapped glib error", () => {
    expect(() => WarnLib.throwUnpaired()).toThrow();
});

test("constructing an abstract or non instantiable type throws", () => {
    const abstractClasses: (new (props?: object) => object)[] = [
        // @ts-expect-error TestInheritDrawable is abstract
        Regress.TestInheritDrawable,
        // @ts-expect-error TestFundamentalObject is abstract
        Regress.TestFundamentalObject,
        // @ts-expect-error InputStream is abstract
        Gio.InputStream,
        // @ts-expect-error TestObjClass is abstract
        Regress.TestObjClass,
        // @ts-expect-error TestInheritDrawableClass is abstract
        Regress.TestInheritDrawableClass,
        // @ts-expect-error HashTable is abstract
        GLib.HashTable,
    ];

    for (const AbstractClass of abstractClasses) {
        expect(() => new AbstractClass({})).toThrow();
    }
});

test("gerror arguments reject values of the wrong type", () => {
    // @ts-expect-error a plain object is not a GLib.Error
    expect(() => GIMarshallingTests.nullableGerror({})).toThrow();
    // @ts-expect-error a string is not a GLib.Error
    expect(() => GIMarshallingTests.nullableGerror("nope")).toThrow();
    // @ts-expect-error a number is not a GLib.Error
    expect(() => GIMarshallingTests.nullableGerror(42)).toThrow();
    // @ts-expect-error a symbol is not a GLib.Error
    expect(() => GIMarshallingTests.nullableGerror(Symbol("nope"))).toThrow();
    expect(() => {
        // @ts-expect-error a string is not an int array
        GIMarshallingTests.gerrorArrayIn("nope");
    }).toThrow();
    expect(() => {
        GIMarshallingTests.gerrorArrayIn([1.5]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a GValue
        GIMarshallingTests.compareTwoGerrorsInGvalue({}, {});
    }).toThrow();
});

test("glib error field writes reject values the fields cannot hold", () => {
    expect(() => new GLib.Error({ domain: ioDomain(), code: 1.5, message: "x" })).toThrow();
    // @ts-expect-error a string is not an error code
    expect(() => new GLib.Error({ domain: ioDomain(), code: "x", message: "y" })).toThrow();
    expect(() => new GLib.Error({ domain: -1, code: 1, message: "y" })).toThrow();
    expect(() => GLib.Error.newLiteral(ioDomain(), 1.5, "x")).toThrow();

    const error = GLib.Error.newLiteral(ioDomain(), Gio.IOErrorEnum.FAILED, "boom");
    expect(() => {
        // @ts-expect-error a string is not an error code
        error.code = "nope";
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not an error message
        error.message = 42;
    }).toThrow();
});

test("overwriting a string field releases the string it displaces", () => {
    const domain = GLib.quarkFromString("gtkx-field-write");
    const error = GLib.Error.newLiteral(domain, 1, "B".repeat(40));

    error.message = "CC";
    expect(error.message).toBe("CC");

    error.message = "D".repeat(40);
    expect(error.message).toBe("D".repeat(40));
});

test("a string field written repeatedly on a gtkx-allocated struct still round-trips", () => {
    const boxed = new GIMarshallingTests.BoxedStruct({ long: 1n, string: "first" });
    boxed.string = "second";
    expect(boxed.string).toBe("second");

    const readBack = boxed.string;
    boxed.string = readBack;
    expect(boxed.string).toBe("second");
});

test("a callee that rejects its argument fails the call instead of the process", () => {
    expect(() => Regress.testIntValueArg(42n)).toThrow();

    const text = new GObject.Value();
    text.init(GObject.typeFromName("gchararray"));
    expect(() => text.getInt()).toThrow();
});

test("a rejected call leaves the binding usable", () => {
    expect(() => Regress.testIntValueArg(42n)).toThrow();

    const value = new GObject.Value();
    value.init(GObject.typeFromName("gint"));
    value.setInt(42);
    expect(Regress.testIntValueArg(value)).toBe(42);
    expect(Regress.testIntValueArg(42)).toBe(42);
});
