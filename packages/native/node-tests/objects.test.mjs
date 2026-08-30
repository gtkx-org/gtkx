import assert from "node:assert/strict";
import { test } from "node:test";
import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import * as Utility from "@gtkx/gi/utility";
import { installMemoryGuard } from "./helpers/memory.mjs";

GIMarshallingTests.Object.noneReturn();
GIMarshallingTests.Object.noneOut();

installMemoryGuard();

test("marshalling objects construct with their int property", () => {
    const built = GIMarshallingTests.Object.new(42);
    assert.equal(built.int, 42);
    assert.ok(built instanceof GIMarshallingTests.Object);
    built.method();

    const fromProps = new GIMarshallingTests.Object({ int: 42 });
    assert.equal(fromProps.int, 42);
    fromProps.method();

    const fresh = new GIMarshallingTests.Object({});
    assert.equal(fresh.int, 0);
    fresh.overriddenMethod();

    GIMarshallingTests.Object.staticMethod();
});

test("object methods marshal scalars and arrays through the instance", () => {
    const obj = GIMarshallingTests.Object.new(0);
    obj.methodWithDefaultImplementation(42);
    assert.equal(obj.int, 42);

    obj.methodArrayIn([-1, 0, 1, 2]);
    assert.deepEqual(obj.methodArrayOut(), [-1, 0, 1, 2]);
    assert.deepEqual(obj.methodArrayReturn(), [-1, 0, 1, 2]);

    obj.int = 7;
    assert.equal(obj.int, 7);
});

test("transfer none returns the same instance and transfer full returns fresh ones", () => {
    const noneFirst = GIMarshallingTests.Object.noneReturn();
    const noneSecond = GIMarshallingTests.Object.noneReturn();
    assert.equal(noneFirst, noneSecond);
    assert.equal(noneFirst.int, 0);

    const outFirst = GIMarshallingTests.Object.noneOut();
    const outSecond = GIMarshallingTests.Object.noneOut();
    assert.equal(outFirst, outSecond);
    assert.equal(outFirst.int, 0);
    assert.notEqual(outFirst, noneFirst);

    const fullFirst = GIMarshallingTests.Object.fullReturn();
    const fullSecond = GIMarshallingTests.Object.fullReturn();
    assert.notEqual(fullFirst, fullSecond);
    assert.equal(fullFirst.int, 0);
    assert.equal(fullSecond.int, 0);

    assert.notEqual(GIMarshallingTests.Object.fullOut(), GIMarshallingTests.Object.fullOut());

    GIMarshallingTests.Object.new(42).noneIn();

    assert.deepEqual(GIMarshallingTests.Object.noneOutUninitialized(), [false, null]);
    assert.deepEqual(GIMarshallingTests.Object.fullOutUninitialized(), [false, null]);
});

test("subclass instances pass wherever the parent type is expected", () => {
    const sub = new GIMarshallingTests.SubObject({});
    assert.ok(sub instanceof GIMarshallingTests.SubObject);
    assert.ok(sub instanceof GIMarshallingTests.Object);
    sub.subMethod();
    sub.overwrittenMethod();
    sub.overriddenMethod();
    sub.int = 42;
    sub.method();
    sub.noneIn();

    const subSub = new GIMarshallingTests.SubSubObject({});
    assert.ok(subSub instanceof GIMarshallingTests.SubObject);
    assert.ok(subSub instanceof GIMarshallingTests.Object);
    subSub.subMethod();
    subSub.methodWithDefaultImplementation(42);
    assert.equal(subSub.int, 42);
    subSub.method();
});

test("test objects construct through each constructor", () => {
    const fromProps = new Regress.TestObj({ int: 42, string: "hello" });
    assert.equal(fromProps.int, 42);
    assert.equal(fromProps.string, "hello");
    assert.ok(fromProps instanceof Regress.TestObj);
    assert.ok(fromProps instanceof GObject.Object);

    const fromNew = Regress.TestObj.new(fromProps);
    assert.ok(fromNew instanceof Regress.TestObj);
    assert.notEqual(fromNew, fromProps);
    assert.equal(fromNew.int, 0);

    const fromFile = Regress.TestObj.newFromFile("/anything");
    assert.ok(fromFile instanceof Regress.TestObj);
    assert.notEqual(fromFile, fromNew);
});

test("test object instance and static methods return their documented values", () => {
    const obj = new Regress.TestObj({});
    assert.equal(obj.instanceMethod(), -1);
    assert.equal(Regress.TestObj.staticMethod(7), 7);

    obj.setString("data");
    assert.equal(obj.getString(), "data");
    assert.equal(obj.string, "data");

    obj.instanceMethodFull();
    assert.equal(obj.instanceMethod(), -1);
});

test("torture signatures return every out value", () => {
    const obj = new Regress.TestObj({});
    assert.deepEqual(obj.tortureSignature0(42, "foo", 7), [42, 84, 10]);
    assert.deepEqual(obj.tortureSignature1(42, "foo", 6), [true, 42, 84, 9]);
});

test("nullable object arguments accept null and compatible objects", () => {
    Regress.funcObjNullIn(null);
    Regress.funcObjNullableIn(null);

    const obj = new Regress.TestObj({});
    Regress.funcObjNullableIn(obj);
    assert.equal(Regress.TestObj.nullOut(), null);

    assert.equal(obj.bare, null);
    const companion = new Utility.Object({});
    assert.ok(companion instanceof GObject.Object);
    obj.setBare(companion);
    assert.equal(obj.bare, companion);
    obj.setBare(null);
    assert.equal(obj.bare, null);
});

test("floating references are sunk on construction", () => {
    const floating = Regress.TestFloating.new();
    assert.ok(floating instanceof Regress.TestFloating);
    assert.ok(floating instanceof GObject.InitiallyUnowned);

    const fromProps = new Regress.TestFloating({});
    assert.ok(fromProps instanceof Regress.TestFloating);
    assert.notEqual(fromProps, floating);
});

test("a list store hands back the identical wrapper it was given", () => {
    const store = Gio.ListStore.new(Regress.TestObj);
    const item = new Regress.TestObj({ int: 5 });
    store.append(item);
    assert.equal(store.getItem(0), item);
    assert.equal(store.getItem(0), store.getItem(0));
    assert.equal(store.getItem(0).int, 5);
});

test("object arguments reject values of the wrong type", () => {
    assert.throws(() => Regress.funcObjNullIn({}));
    assert.throws(() => Regress.funcObjNullIn("nope"));
    assert.throws(() => Regress.funcObjNullIn(Symbol("nope")));
    assert.throws(() => Regress.TestObj.new(null));
    assert.throws(() => GIMarshallingTests.Object.new(1.5));
    assert.throws(() => new GIMarshallingTests.Object({ int: "nope" }));
});

test("object calls surface native errors as exceptions", () => {
    assert.throws(() => GIMarshallingTests.Object.newFail(42));

    const obj = new Regress.TestObj({});
    assert.throws(() => obj.tortureSignature1(42, "foo", 7));

    assert.throws(() => GIMarshallingTests.Object.new(42).fullIn());
});
