import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import * as WarnLib from "@gtkx/gi/warnlib";
import assert from "node:assert/strict";
import { test } from "node:test";
import { drainAfterEachTest } from "./helpers/memory.mjs";

drainAfterEachTest();

const capture = (call) => {
    try {
        call();
    } catch (error) {
        return error;
    }

    return null;
};

const marshallingDomain = () => GLib.quarkFromString(GIMarshallingTests.CONSTANT_GERROR_DOMAIN);
const ioDomain = () => GLib.quarkFromString("g-io-error-quark");

test("a failing call throws a glib error carrying the c domain, code and message", () => {
    assert.throws(() => GIMarshallingTests.gerror());

    const error = capture(() => GIMarshallingTests.gerror());
    assert.ok(error instanceof GLib.Error);
    assert.ok(error instanceof Error);
    assert.equal(error.domain, marshallingDomain());
    assert.equal(error.code, GIMarshallingTests.CONSTANT_GERROR_CODE);
    assert.equal(error.message, GIMarshallingTests.CONSTANT_GERROR_MESSAGE);
    assert.equal(error.name, "GLib.Error");
    assert.equal(typeof error.stack, "string");
});

test("a call that throws after marshalling its array reports the same error", () => {
    assert.throws(() => GIMarshallingTests.gerrorArrayIn([-1, 0, 1, 2]));
    assert.throws(() => GIMarshallingTests.gerrorArrayIn([]));

    const error = capture(() => GIMarshallingTests.gerrorArrayIn([-1, 0, 1, 2]));
    assert.ok(error instanceof GLib.Error);
    assert.equal(error.domain, marshallingDomain());
    assert.equal(error.code, GIMarshallingTests.CONSTANT_GERROR_CODE);
    assert.equal(error.message, GIMarshallingTests.CONSTANT_GERROR_MESSAGE);
});

test("a gerror declared as an out parameter is returned instead of thrown", () => {
    const [error, debug] = GIMarshallingTests.gerrorOut();
    assert.ok(error instanceof GLib.Error);
    assert.equal(error.domain, marshallingDomain());
    assert.equal(error.code, GIMarshallingTests.CONSTANT_GERROR_CODE);
    assert.equal(error.message, GIMarshallingTests.CONSTANT_GERROR_MESSAGE);
    assert.equal(debug, GIMarshallingTests.CONSTANT_GERROR_DEBUG_MESSAGE);

    const [other] = GIMarshallingTests.gerrorOut();
    assert.notEqual(other, error);
    error.code = 7;
    assert.equal(other.code, GIMarshallingTests.CONSTANT_GERROR_CODE);
    assert.equal(GIMarshallingTests.gerrorOut()[0].code, GIMarshallingTests.CONSTANT_GERROR_CODE);
});

test("a transfer none gerror out parameter decodes as an independent copy", () => {
    const [error, debug] = GIMarshallingTests.gerrorOutTransferNone();
    assert.ok(error instanceof GLib.Error);
    assert.equal(error.domain, marshallingDomain());
    assert.equal(error.code, GIMarshallingTests.CONSTANT_GERROR_CODE);
    assert.equal(error.message, GIMarshallingTests.CONSTANT_GERROR_MESSAGE);
    assert.equal(debug, GIMarshallingTests.CONSTANT_GERROR_DEBUG_MESSAGE);

    error.code = 99;
    const [second, secondDebug] = GIMarshallingTests.gerrorOutTransferNone();
    assert.notEqual(second, error);
    assert.equal(second.code, GIMarshallingTests.CONSTANT_GERROR_CODE);
    assert.equal(secondDebug, GIMarshallingTests.CONSTANT_GERROR_DEBUG_MESSAGE);
});

test("uninitialized gerror out parameters report failure with nulls", () => {
    assert.deepEqual(GIMarshallingTests.gerrorOutUninitialized(), [false, null, null]);
    assert.deepEqual(GIMarshallingTests.gerrorOutTransferNoneUninitialized(), [false, null, null]);
});

test("a returned gerror is an owned value with working error methods", () => {
    const error = GIMarshallingTests.gerrorReturn();
    assert.ok(error instanceof GLib.Error);
    assert.ok(error instanceof Error);
    assert.equal(error.domain, marshallingDomain());
    assert.equal(error.code, GIMarshallingTests.CONSTANT_GERROR_CODE);
    assert.equal(error.message, GIMarshallingTests.CONSTANT_GERROR_MESSAGE);

    assert.equal(error.matches(marshallingDomain(), GIMarshallingTests.CONSTANT_GERROR_CODE), true);
    assert.equal(error.matches(marshallingDomain(), 6), false);
    assert.equal(error.matches(ioDomain(), GIMarshallingTests.CONSTANT_GERROR_CODE), false);

    const copy = error.copy();
    assert.equal(copy.code, GIMarshallingTests.CONSTANT_GERROR_CODE);
    assert.equal(copy.message, GIMarshallingTests.CONSTANT_GERROR_MESSAGE);
    copy.code = 11;
    assert.equal(error.code, GIMarshallingTests.CONSTANT_GERROR_CODE);
    assert.notEqual(GIMarshallingTests.gerrorReturn(), error);
});

test("a constructor that fails throws instead of returning an instance", () => {
    assert.throws(() => GIMarshallingTests.Object.newFail(42));

    const error = capture(() => GIMarshallingTests.Object.newFail(42));
    assert.ok(error instanceof GLib.Error);
    assert.equal(error.domain, marshallingDomain());
    assert.equal(error.code, GIMarshallingTests.CONSTANT_GERROR_CODE);
    assert.equal(error.message, GIMarshallingTests.CONSTANT_GERROR_MESSAGE);
    assert.equal(GIMarshallingTests.Object.new(42).int, 42);
});

test("glib errors round trip the fields they are constructed with", () => {
    const literal = GLib.Error.newLiteral(ioDomain(), Gio.IOErrorEnum.NOT_FOUND, "not found here");
    assert.equal(literal.domain, ioDomain());
    assert.equal(literal.code, Gio.IOErrorEnum.NOT_FOUND);
    assert.equal(literal.message, "not found here");

    literal.code = Gio.IOErrorEnum.EXISTS;
    assert.equal(literal.code, Gio.IOErrorEnum.EXISTS);
    assert.equal(literal.message, "not found here");
    assert.equal(literal.matches(ioDomain(), Gio.IOErrorEnum.EXISTS), true);

    const built = new GLib.Error({ domain: ioDomain(), code: Gio.IOErrorEnum.BUSY, message: "busy" });
    assert.equal(built.domain, ioDomain());
    assert.equal(built.code, Gio.IOErrorEnum.BUSY);
    assert.equal(built.message, "busy");
    assert.equal(built.matches(ioDomain(), Gio.IOErrorEnum.BUSY), true);
});

test("a nullable gerror argument accepts null and an owned error", () => {
    assert.equal(GIMarshallingTests.nullableGerror(null), false);
    assert.equal(GIMarshallingTests.nullableGerror(GIMarshallingTests.gerrorReturn()), true);
    const boom = GLib.Error.newLiteral(ioDomain(), Gio.IOErrorEnum.FAILED, "boom");
    assert.equal(GIMarshallingTests.nullableGerror(boom), true);
});

test("errors travel through gvalues as boxed payloads", () => {
    const boxedError = () => {
        const value = new GObject.Value();
        value.init(GLib.Error);
        value.setBoxed(GIMarshallingTests.gerrorReturn());

        return value;
    };

    const value = boxedError();
    const back = value.getBoxed();
    assert.ok(back instanceof GLib.Error);
    assert.equal(back.domain, marshallingDomain());
    assert.equal(back.code, GIMarshallingTests.CONSTANT_GERROR_CODE);
    assert.equal(back.message, GIMarshallingTests.CONSTANT_GERROR_MESSAGE);

    GIMarshallingTests.compareTwoGerrorsInGvalue(value, boxedError());
});

test("regress calls with a trailing gerror return their values when they succeed", () => {
    assert.deepEqual(Regress.testTortureSignature1(42, "foo", 6), [true, 42, 84, 9]);

    const obj = new Regress.TestObj({});
    assert.deepEqual(obj.skipParam(1, 2.5, 3, 4, 5), [true, 2, 4, 54]);
    assert.deepEqual(obj.skipOutParam(1, 2.5, 3, 4, 5), [true, 2, 4, 54]);
    assert.deepEqual(obj.skipInoutParam(1, 2.5, 3, 4, 5), [true, 2, 4, 54]);
    assert.deepEqual(obj.skipReturnVal(1, 2.5, 3, 4, 5), [2, 4, 54]);
    assert.equal(obj.skipReturnValNoOut(1), undefined);

    const fromFile = Regress.TestObj.newFromFile("/anything");
    assert.ok(fromFile instanceof Regress.TestObj);
    assert.equal(fromFile.int, 0);
});

test("regress calls with a trailing gerror throw the io error they set", () => {
    assert.throws(() => Regress.testTortureSignature1(42, "foo", 7));
    assert.throws(() => new Regress.TestObj({}).skipReturnValNoOut(0));

    const error = capture(() => Regress.testTortureSignature1(42, "foo", 7));
    assert.ok(error instanceof GLib.Error);
    assert.equal(error.domain, ioDomain());
    assert.equal(error.code, Gio.IOErrorEnum.FAILED);

    const fromMethod = capture(() => new Regress.TestObj({}).skipReturnValNoOut(0));
    assert.equal(fromMethod.domain, ioDomain());
    assert.equal(fromMethod.code, Gio.IOErrorEnum.FAILED);
});

test("error domain objects match only the errors of their own domain", () => {
    const io = capture(() => Regress.testTortureSignature1(42, "foo", 7));
    assert.ok(io instanceof Gio.IOErrorEnum);
    assert.equal(io instanceof Regress.TestError, false);

    const marshalling = capture(() => GIMarshallingTests.gerror());
    assert.equal(marshalling instanceof Gio.IOErrorEnum, false);
    assert.equal(marshalling instanceof Regress.TestError, false);

    assert.equal(Gio.IOErrorEnum.FAILED, 0);
    assert.equal(Gio.IOErrorEnum.NOT_SUPPORTED, 15);
    assert.equal(Regress.TestError.CODE1, 1);
    assert.equal(new GObject.Object({}) instanceof Gio.IOErrorEnum, false);
});

test("an unregistered error domain still throws a wrapped glib error", () => {
    assert.throws(() => WarnLib.throwUnpaired());

    const error = capture(() => WarnLib.throwUnpaired());
    assert.ok(error instanceof GLib.Error);
    assert.equal(error.domain, WarnLib.unpairedErrorQuark());
    assert.equal(error.domain, GLib.quarkFromString("warnlib-unpaired-error"));
    assert.equal(error.code, 0);
    assert.equal(error.matches(WarnLib.unpairedErrorQuark(), 0), true);
});

test("a stream of thrown errors leaves the bindings usable", () => {
    for (let round = 0; round < 100; round += 1) {
        assert.throws(() => GIMarshallingTests.gerror());
        assert.throws(() => WarnLib.throwUnpaired());
        assert.throws(() => Regress.testTortureSignature1(42, "foo", 7));
    }

    assert.deepEqual(Regress.testTortureSignature1(42, "foo", 6), [true, 42, 84, 9]);
    assert.equal(GIMarshallingTests.gerrorOut()[1], GIMarshallingTests.CONSTANT_GERROR_DEBUG_MESSAGE);
    assert.equal(GIMarshallingTests.gerrorReturn().code, GIMarshallingTests.CONSTANT_GERROR_CODE);
    assert.equal(GIMarshallingTests.nullableGerror(null), false);
});

test("constructing an abstract or non instantiable type throws", () => {
    assert.throws(() => new Regress.TestInheritDrawable({}));
    assert.throws(() => new Regress.TestFundamentalObject({}));
    assert.throws(() => new Gio.InputStream({}));
    assert.throws(() => new Regress.TestObjClass());
    assert.throws(() => new Regress.TestInheritDrawableClass());
    assert.throws(() => new GLib.HashTable());
});

test("gerror arguments reject values of the wrong type", () => {
    assert.throws(() => GIMarshallingTests.nullableGerror({}));
    assert.throws(() => GIMarshallingTests.nullableGerror("nope"));
    assert.throws(() => GIMarshallingTests.nullableGerror(42));
    assert.throws(() => GIMarshallingTests.nullableGerror(Symbol("nope")));
    assert.throws(() => GIMarshallingTests.gerrorArrayIn("nope"));
    assert.throws(() => GIMarshallingTests.gerrorArrayIn([1.5]));
    assert.throws(() => GIMarshallingTests.compareTwoGerrorsInGvalue({}, {}));
});

test("glib error field writes reject values the fields cannot hold", () => {
    assert.throws(() => new GLib.Error({ domain: ioDomain(), code: 1.5, message: "x" }));
    assert.throws(() => new GLib.Error({ domain: ioDomain(), code: "x", message: "y" }));
    assert.throws(() => new GLib.Error({ domain: -1, code: 1, message: "y" }));
    assert.throws(() => GLib.Error.newLiteral(ioDomain(), 1.5, "x"));

    const error = GLib.Error.newLiteral(ioDomain(), Gio.IOErrorEnum.FAILED, "boom");
    assert.throws(() => {
        error.code = "nope";
    });
    assert.throws(() => {
        error.message = 42;
    });
});
