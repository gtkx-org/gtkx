import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { getType } from "@gtkx/native";
import {
    fromValue,
    getClassType,
    getHandle,
    getInstanceType,
    typeFromName,
    typeIsA,
    typeName,
    typeParent,
} from "@gtkx/runtime";
import assert from "node:assert/strict";
import { test } from "node:test";
import { drainAfterEachTest, drainGC, gcUntil } from "./helpers/memory.mjs";

drainAfterEachTest();

test("fundamental sub objects construct through their static constructor", () => {
    const sub = Regress.TestFundamentalSubObject.new("foo");
    assert.ok(sub instanceof Regress.TestFundamentalSubObject);
    assert.ok(sub instanceof Regress.TestFundamentalObject);
    assert.equal(Regress.testFundamentalArgumentIn(sub), true);
    assert.equal(Regress.testFundamentalArgumentOut(sub), sub);

    const other = Regress.TestFundamentalSubObject.new("bar");
    assert.notEqual(other, sub);
    assert.equal(Regress.testFundamentalArgumentIn(other), true);
});

test("fundamentals without value functions keep the data they were built with", () => {
    const base = Regress.TestFundamentalObjectNoGetSetFunc.new("hello");
    assert.ok(base instanceof Regress.TestFundamentalObjectNoGetSetFunc);
    assert.equal(base.getData(), "hello");

    const sub = Regress.TestFundamentalSubObjectNoGetSetFunc.new("bye");
    assert.ok(sub instanceof Regress.TestFundamentalSubObjectNoGetSetFunc);
    assert.ok(sub instanceof Regress.TestFundamentalObjectNoGetSetFunc);
    assert.equal(sub.getData(), "bye");
    assert.equal(Regress.TestFundamentalObjectNoGetSetFunc.new("").getData(), "");
});

test("the same fundamental instance reaches JS as one wrapper", () => {
    const sub = Regress.TestFundamentalSubObject.new("foo");
    assert.equal(Regress.testFundamentalArgumentOut(sub), sub);
    assert.equal(Regress.testFundamentalArgumentOut(sub), Regress.testFundamentalArgumentOut(sub));

    const value = new GObject.Value();
    value.initFromInstance(sub);
    assert.equal(fromValue(getHandle(value)), sub);
    assert.equal(fromValue(getHandle(value)), fromValue(getHandle(value)));

    const noGetSet = Regress.TestFundamentalObjectNoGetSetFunc.new("hello");
    const noGetSetValue = new GObject.Value();
    noGetSetValue.initFromInstance(noGetSet);
    assert.equal(fromValue(getHandle(noGetSetValue)), noGetSet);
    assert.notEqual(fromValue(getHandle(noGetSetValue)), sub);
});

test("a transfer full fundamental argument leaves the wrapper usable", () => {
    const sub = Regress.TestFundamentalSubObject.new("foo");
    assert.equal(Regress.testFundamentalArgumentIn(sub), true);
    assert.equal(Regress.testFundamentalArgumentIn(sub), true);
    assert.equal(Regress.testFundamentalArgumentOut(sub), sub);
    assert.equal(Regress.testArrayOfFundamentalObjectsIn([sub]), true);
});

test("arrays of fundamentals marshal in both directions", () => {
    const first = Regress.TestFundamentalSubObject.new("a");
    const second = Regress.TestFundamentalSubObject.new("b");
    assert.equal(Regress.testArrayOfFundamentalObjectsIn([first, second]), true);
    assert.equal(Regress.testArrayOfFundamentalObjectsIn([first, first]), true);
    assert.equal(Regress.testArrayOfFundamentalObjectsIn([]), true);

    const out = Regress.testArrayOfFundamentalObjectsOut();
    assert.equal(out.length, 2);
    assert.ok(out[0] instanceof Regress.TestFundamentalSubObject);
    assert.ok(out[1] instanceof Regress.TestFundamentalSubObject);
    assert.notEqual(out[0], out[1]);
    assert.equal(Regress.testFundamentalArgumentOut(out[0]), out[0]);
    assert.equal(Regress.testArrayOfFundamentalObjectsIn(out), true);
    assert.notEqual(Regress.testArrayOfFundamentalObjectsOut()[0], out[0]);
});

test("an instance of an unregistered subclass wraps as its nearest registered ancestor", () => {
    const hidden = Regress.testCreateFundamentalHiddenClassInstance();
    assert.ok(hidden instanceof Regress.TestFundamentalObject);
    assert.equal(hidden instanceof Regress.TestFundamentalSubObject, false);
    assert.equal(Regress.testFundamentalArgumentOut(hidden), hidden);
    assert.equal(Regress.testFundamentalArgumentIn(hidden), true);
    assert.notEqual(Regress.testCreateFundamentalHiddenClassInstance(), hidden);
});

test("a fundamental root does not match an unrelated fundamental root", () => {
    const foreign = Regress.TestFundamentalObjectNoGetSetFunc.new("hello");
    assert.equal(Regress.testFundamentalArgumentIn(foreign), false);
    assert.equal(foreign.getData(), "hello");
});

test("a GValue round trips a fundamental it was initialized from", () => {
    const sub = Regress.TestFundamentalSubObject.new("foo");
    const value = new GObject.Value();
    value.initFromInstance(sub);
    const read = fromValue(getHandle(value));
    assert.equal(read, sub);
    assert.ok(read instanceof Regress.TestFundamentalSubObject);

    const copy = new GObject.Value();
    copy.init(getClassType(Regress.TestFundamentalSubObject));
    value.copy(copy);
    assert.equal(fromValue(getHandle(copy)), sub);

    const noGetSet = Regress.TestFundamentalObjectNoGetSetFunc.new("hello");
    const noGetSetValue = new GObject.Value();
    noGetSetValue.initFromInstance(noGetSet);
    const readNoGetSet = fromValue(getHandle(noGetSetValue));
    assert.equal(readNoGetSet, noGetSet);
    assert.equal(readNoGetSet.getData(), "hello");
});

test("a registered transform turns one fundamental value into another", () => {
    const existing = Regress.TestFundamentalSubObject.new("existing");
    const source = getClassType(Regress.TestFundamentalObjectNoGetSetFunc);
    const target = getClassType(Regress.TestFundamentalSubObject);
    assert.equal(GObject.Value.typeTransformable(source, target), false);

    Regress.TestFundamentalObjectNoGetSetFunc.makeCompatibleWithFundamentalSubObject();
    assert.equal(GObject.Value.typeTransformable(source, target), true);

    const held = Regress.TestFundamentalObjectNoGetSetFunc.new("moved");
    const value = new GObject.Value();
    value.initFromInstance(held);
    const converted = new GObject.Value();
    converted.init(target);
    assert.equal(value.transform(converted), true);

    const result = fromValue(getHandle(converted));
    assert.ok(result instanceof Regress.TestFundamentalSubObject);
    assert.notEqual(result, existing);
    assert.notEqual(result, held);
    assert.equal(Regress.testFundamentalArgumentOut(result), result);

    const unrelated = new GObject.Value();
    unrelated.init(typeFromName("gint"));
    assert.equal(value.transform(unrelated), false);
});

test("a fundamental outlives its collected wrapper and revives through a fresh read", async () => {
    const stash = () => {
        const held = Regress.TestFundamentalObjectNoGetSetFunc.new("kept");
        const value = new GObject.Value();
        value.initFromInstance(held);

        return { value, weak: new WeakRef(held) };
    };

    const { value, weak } = stash();
    assert.ok(await gcUntil(() => weak.deref() === undefined));
    await drainGC();
    assert.equal(weak.deref(), undefined);

    const revived = fromValue(getHandle(value));
    assert.ok(revived instanceof Regress.TestFundamentalObjectNoGetSetFunc);
    assert.equal(revived.getData(), "kept");
    assert.equal(fromValue(getHandle(value)), revived);
    assert.equal(revived.getData(), "kept");
});

test("class type inspection reports the registered fundamental types", () => {
    const base = getClassType(Regress.TestFundamentalObject);
    const sub = getClassType(Regress.TestFundamentalSubObject);
    const noGetSet = getClassType(Regress.TestFundamentalObjectNoGetSetFunc);
    const subNoGetSet = getClassType(Regress.TestFundamentalSubObjectNoGetSetFunc);

    assert.equal(typeName(base), "RegressTestFundamentalObject");
    assert.equal(typeName(sub), "RegressTestFundamentalSubObject");
    assert.equal(typeName(noGetSet), "RegressTestFundamentalObjectNoGetSetFunc");
    assert.equal(typeName(subNoGetSet), "RegressTestFundamentalSubObjectNoGetSetFunc");

    assert.equal(typeParent(sub), base);
    assert.equal(typeParent(subNoGetSet), noGetSet);
    assert.equal(typeIsA(sub, base), true);
    assert.equal(typeIsA(subNoGetSet, noGetSet), true);
    assert.equal(typeIsA(sub, noGetSet), false);
    assert.equal(typeIsA(base, noGetSet), false);
});

test("instance type inspection needs the declared type a fundamental handle carries no tag without", () => {
    const instance = Regress.TestFundamentalSubObject.new("foo");
    const base = getClassType(Regress.TestFundamentalObject);

    assert.equal(getType(getHandle(instance), base), getClassType(Regress.TestFundamentalSubObject));
    assert.equal(getInstanceType(instance), 0n);

    const noGetSetRoot = getClassType(Regress.TestFundamentalObjectNoGetSetFunc);
    const noGetSet = Regress.TestFundamentalObjectNoGetSetFunc.new("hello");
    assert.equal(getType(getHandle(noGetSet), noGetSetRoot), noGetSetRoot);
    assert.equal(getInstanceType(noGetSet), 0n);

    const subNoGetSet = Regress.TestFundamentalSubObjectNoGetSetFunc.new("bye");
    assert.equal(
        getType(getHandle(subNoGetSet), noGetSetRoot),
        getClassType(Regress.TestFundamentalSubObjectNoGetSetFunc),
    );
});

test("a fundamental argument rejects a handle from another family", () => {
    assert.equal(Regress.testFundamentalArgumentIn(Regress.TestFundamentalSubObject.new("payload")), true);

    assert.throws(() => Regress.testFundamentalArgumentIn(new Regress.TestObj({})));
    assert.throws(() => Regress.testFundamentalArgumentIn(new GIMarshallingTests.BoxedStruct({ long: 1n })));
    assert.throws(() =>
        Regress.testFundamentalArgumentIn(
            GObject.paramSpecInt("count", null, null, 0, 10, 5, GObject.ParamFlags.READABLE),
        ),
    );
});

test("fundamental arguments reject values that carry no native handle", () => {
    assert.throws(() => Regress.testFundamentalArgumentIn({}));
    assert.throws(() => Regress.testFundamentalArgumentIn(42));
    assert.throws(() => Regress.testFundamentalArgumentIn("nope"));
    assert.throws(() => Regress.testFundamentalArgumentIn(Symbol("nope")));
    assert.throws(() => Regress.testFundamentalArgumentOut({}));
    assert.throws(() => Regress.testFundamentalArgumentOut(0));
});

test("fundamental arrays reject elements that carry no native handle", () => {
    assert.throws(() => Regress.testArrayOfFundamentalObjectsIn([{}]));
    assert.throws(() => Regress.testArrayOfFundamentalObjectsIn([1, 2]));
    assert.throws(() => Regress.testArrayOfFundamentalObjectsIn(["a"]));
    assert.throws(() => Regress.testArrayOfFundamentalObjectsIn([Regress.TestFundamentalSubObject.new("a"), {}]));
});

test("fundamental constructors reject data that is not a string", () => {
    assert.throws(() => Regress.TestFundamentalSubObject.new(42));
    assert.throws(() => Regress.TestFundamentalObjectNoGetSetFunc.new({}));
    assert.throws(() => Regress.TestFundamentalSubObjectNoGetSetFunc.new(Symbol("nope")));
});

test("fundamental types are not constructible with new", () => {
    assert.throws(() => new Regress.TestFundamentalObject({}));
    assert.throws(() => new Regress.TestFundamentalSubObject({}));
    assert.throws(() => new Regress.TestFundamentalObjectNoGetSetFunc({}));
    assert.throws(() => new Regress.TestFundamentalSubObjectNoGetSetFunc({}));
    assert.throws(() => new GObject.ParamSpecInt({}));
});

test("fundamental instances still come from their own constructors", () => {
    const sub = Regress.TestFundamentalSubObject.new("payload");
    assert.ok(sub instanceof Regress.TestFundamentalObject);

    const plain = Regress.TestFundamentalObjectNoGetSetFunc.new("payload");
    assert.equal(plain.getData(), "payload");

    const spec = GObject.paramSpecInt("count", null, null, 0, 10, 5, GObject.ParamFlags.READABLE);
    assert.ok(spec instanceof GObject.ParamSpecInt);
    assert.equal(spec.getName(), "count");
});

test("initializing a GValue rejects instances that carry no native handle", () => {
    assert.throws(() => new GObject.Value().initFromInstance({}));
    assert.throws(() => new GObject.Value().initFromInstance(7));
    assert.throws(() => new GObject.Value().initFromInstance("nope"));
    assert.throws(() => new GObject.Value().initFromInstance(Symbol("nope")));
});
