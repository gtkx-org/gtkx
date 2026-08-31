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
import { expect, test } from "vitest";
import { didSettle, drainAfterEachTest, drainGC } from "./helpers/memory.js";

drainAfterEachTest();

test("fundamental sub objects construct through their static constructor", () => {
    const sub = Regress.TestFundamentalSubObject.new("foo");
    expect(sub instanceof Regress.TestFundamentalSubObject).toBeTruthy();
    expect(sub instanceof Regress.TestFundamentalObject).toBeTruthy();
    expect(Regress.testFundamentalArgumentIn(sub)).toBe(true);
    expect(Regress.testFundamentalArgumentOut(sub)).toBe(sub);

    const other = Regress.TestFundamentalSubObject.new("bar");
    expect(other).not.toBe(sub);
    expect(Regress.testFundamentalArgumentIn(other)).toBe(true);
});

test("fundamentals without value functions keep the data they were built with", () => {
    const base = Regress.TestFundamentalObjectNoGetSetFunc.new("hello");
    expect(base instanceof Regress.TestFundamentalObjectNoGetSetFunc).toBeTruthy();
    expect(base.getData()).toBe("hello");

    const sub = Regress.TestFundamentalSubObjectNoGetSetFunc.new("bye");
    expect(sub instanceof Regress.TestFundamentalSubObjectNoGetSetFunc).toBeTruthy();
    expect(sub instanceof Regress.TestFundamentalObjectNoGetSetFunc).toBeTruthy();
    expect(sub.getData()).toBe("bye");
    expect(Regress.TestFundamentalObjectNoGetSetFunc.new("").getData()).toBe("");
});

test("the same fundamental instance reaches JS as one wrapper", () => {
    const sub = Regress.TestFundamentalSubObject.new("foo");
    expect(Regress.testFundamentalArgumentOut(sub)).toBe(sub);
    expect(Regress.testFundamentalArgumentOut(sub)).toBe(Regress.testFundamentalArgumentOut(sub));

    const value = new GObject.Value();
    // @ts-expect-error a fundamental is a GTypeInstance the generated type does not declare
    value.initFromInstance(sub);
    expect(fromValue(getHandle(value))).toBe(sub);
    expect(fromValue(getHandle(value))).toBe(fromValue(getHandle(value)));

    const noGetSet = Regress.TestFundamentalObjectNoGetSetFunc.new("hello");
    const noGetSetValue = new GObject.Value();
    // @ts-expect-error a fundamental is a GTypeInstance the generated type does not declare
    noGetSetValue.initFromInstance(noGetSet);
    expect(fromValue(getHandle(noGetSetValue))).toBe(noGetSet);
    expect(fromValue(getHandle(noGetSetValue))).not.toBe(sub);
});

test("a transfer full fundamental argument leaves the wrapper usable", () => {
    const sub = Regress.TestFundamentalSubObject.new("foo");
    expect(Regress.testFundamentalArgumentIn(sub)).toBe(true);
    expect(Regress.testFundamentalArgumentIn(sub)).toBe(true);
    expect(Regress.testFundamentalArgumentOut(sub)).toBe(sub);
    expect(Regress.testArrayOfFundamentalObjectsIn([sub])).toBe(true);
});

test("arrays of fundamentals marshal in both directions", () => {
    const first = Regress.TestFundamentalSubObject.new("a");
    const second = Regress.TestFundamentalSubObject.new("b");
    expect(Regress.testArrayOfFundamentalObjectsIn([first, second])).toBe(true);
    expect(Regress.testArrayOfFundamentalObjectsIn([first, first])).toBe(true);
    expect(Regress.testArrayOfFundamentalObjectsIn([])).toBe(true);

    const out = Regress.testArrayOfFundamentalObjectsOut();
    expect(out).toHaveLength(2);
    expect(out[0] instanceof Regress.TestFundamentalSubObject).toBeTruthy();
    expect(out[1] instanceof Regress.TestFundamentalSubObject).toBeTruthy();
    expect(out[0]).not.toBe(out[1]);
    expect(Regress.testFundamentalArgumentOut(out[0] as Regress.TestFundamentalObject)).toBe(out[0]);
    expect(Regress.testArrayOfFundamentalObjectsIn(out)).toBe(true);
    expect(Regress.testArrayOfFundamentalObjectsOut()[0]).not.toBe(out[0]);
});

test("an instance of an unregistered subclass wraps as its nearest registered ancestor", () => {
    const hidden = Regress.testCreateFundamentalHiddenClassInstance();
    expect(hidden instanceof Regress.TestFundamentalObject).toBeTruthy();
    expect(hidden).not.toBeInstanceOf(Regress.TestFundamentalSubObject);
    expect(Regress.testFundamentalArgumentOut(hidden)).toBe(hidden);
    expect(Regress.testFundamentalArgumentIn(hidden)).toBe(true);
    expect(Regress.testCreateFundamentalHiddenClassInstance()).not.toBe(hidden);
});

test("a fundamental root does not match an unrelated fundamental root", () => {
    const foreign = Regress.TestFundamentalObjectNoGetSetFunc.new("hello");
    expect(Regress.testFundamentalArgumentIn(foreign)).toBe(false);
    expect(foreign.getData()).toBe("hello");
});

test("a GValue round trips a fundamental it was initialized from", () => {
    const sub = Regress.TestFundamentalSubObject.new("foo");
    const value = new GObject.Value();
    // @ts-expect-error a fundamental is a GTypeInstance the generated type does not declare
    value.initFromInstance(sub);
    const read = fromValue(getHandle(value));
    expect(read).toBe(sub);
    expect(read instanceof Regress.TestFundamentalSubObject).toBeTruthy();

    const copy = new GObject.Value();
    copy.init(getClassType(Regress.TestFundamentalSubObject));
    value.copy(copy);
    expect(fromValue(getHandle(copy))).toBe(sub);

    const noGetSet = Regress.TestFundamentalObjectNoGetSetFunc.new("hello");
    const noGetSetValue = new GObject.Value();
    // @ts-expect-error a fundamental is a GTypeInstance the generated type does not declare
    noGetSetValue.initFromInstance(noGetSet);
    const readNoGetSet = fromValue(getHandle(noGetSetValue)) as Regress.TestFundamentalObjectNoGetSetFunc;
    expect(readNoGetSet).toBe(noGetSet);
    expect(readNoGetSet.getData()).toBe("hello");
});

test("a registered transform turns one fundamental value into another", () => {
    const existing = Regress.TestFundamentalSubObject.new("existing");
    const source = getClassType(Regress.TestFundamentalObjectNoGetSetFunc);
    const target = getClassType(Regress.TestFundamentalSubObject);
    expect(GObject.Value.typeTransformable(source, target)).toBe(false);

    Regress.TestFundamentalObjectNoGetSetFunc.makeCompatibleWithFundamentalSubObject();
    expect(GObject.Value.typeTransformable(source, target)).toBe(true);

    const held = Regress.TestFundamentalObjectNoGetSetFunc.new("moved");
    const value = new GObject.Value();
    // @ts-expect-error a fundamental is a GTypeInstance the generated type does not declare
    value.initFromInstance(held);
    const converted = new GObject.Value();
    converted.init(target);
    expect(value.transform(converted)).toBe(true);

    const result = fromValue(getHandle(converted)) as Regress.TestFundamentalSubObject;
    expect(result instanceof Regress.TestFundamentalSubObject).toBeTruthy();
    expect(result).not.toBe(existing);
    expect(result).not.toBe(held);
    expect(Regress.testFundamentalArgumentOut(result)).toBe(result);

    const unrelated = new GObject.Value();
    unrelated.init(typeFromName("gint"));
    expect(value.transform(unrelated)).toBe(false);
});

test("a fundamental outlives its collected wrapper and revives through a fresh read", async () => {
    const stash = () => {
        const held = Regress.TestFundamentalObjectNoGetSetFunc.new("kept");
        const value = new GObject.Value();
        // @ts-expect-error a fundamental is a GTypeInstance the generated type does not declare
        value.initFromInstance(held);

        return { value, weak: new WeakRef(held) };
    };

    const { value, weak } = stash();
    expect(await didSettle(() => weak.deref() === undefined)).toBeTruthy();
    await drainGC();
    expect(weak.deref()).toBeUndefined();

    const revived = fromValue(getHandle(value)) as Regress.TestFundamentalObjectNoGetSetFunc;
    expect(revived instanceof Regress.TestFundamentalObjectNoGetSetFunc).toBeTruthy();
    expect(revived.getData()).toBe("kept");
    expect(fromValue(getHandle(value))).toBe(revived);
    expect(revived.getData()).toBe("kept");
});

test("class type inspection reports the registered fundamental types", () => {
    const base = getClassType(Regress.TestFundamentalObject);
    const sub = getClassType(Regress.TestFundamentalSubObject);
    const noGetSet = getClassType(Regress.TestFundamentalObjectNoGetSetFunc);
    const subNoGetSet = getClassType(Regress.TestFundamentalSubObjectNoGetSetFunc);

    expect(typeName(base)).toBe("RegressTestFundamentalObject");
    expect(typeName(sub)).toBe("RegressTestFundamentalSubObject");
    expect(typeName(noGetSet)).toBe("RegressTestFundamentalObjectNoGetSetFunc");
    expect(typeName(subNoGetSet)).toBe("RegressTestFundamentalSubObjectNoGetSetFunc");

    expect(typeParent(sub)).toBe(base);
    expect(typeParent(subNoGetSet)).toBe(noGetSet);
    expect(typeIsA(sub, base)).toBe(true);
    expect(typeIsA(subNoGetSet, noGetSet)).toBe(true);
    expect(typeIsA(sub, noGetSet)).toBe(false);
    expect(typeIsA(base, noGetSet)).toBe(false);
});

test("instance type inspection needs the declared type a fundamental handle carries no tag without", () => {
    const instance = Regress.TestFundamentalSubObject.new("foo");
    const base = getClassType(Regress.TestFundamentalObject);

    expect(getType(getHandle(instance), base)).toBe(getClassType(Regress.TestFundamentalSubObject));
    expect(getInstanceType(instance)).toBe(0n);

    const noGetSetRoot = getClassType(Regress.TestFundamentalObjectNoGetSetFunc);
    const noGetSet = Regress.TestFundamentalObjectNoGetSetFunc.new("hello");
    expect(getType(getHandle(noGetSet), noGetSetRoot)).toBe(noGetSetRoot);
    expect(getInstanceType(noGetSet)).toBe(0n);

    const subNoGetSet = Regress.TestFundamentalSubObjectNoGetSetFunc.new("bye");
    expect(getType(getHandle(subNoGetSet), noGetSetRoot)).toBe(
        getClassType(Regress.TestFundamentalSubObjectNoGetSetFunc),
    );
});

test("a fundamental argument rejects a handle from another family", () => {
    expect(Regress.testFundamentalArgumentIn(Regress.TestFundamentalSubObject.new("payload"))).toBe(true);

    expect(() => Regress.testFundamentalArgumentIn(new Regress.TestObj({}))).toThrow();
    // @ts-expect-error a BoxedStruct is not a TestFundamentalObject
    expect(() => Regress.testFundamentalArgumentIn(new GIMarshallingTests.BoxedStruct({ long: 1n }))).toThrow();
    expect(() =>
        Regress.testFundamentalArgumentIn(
            GObject.paramSpecInt("count", null, null, 0, 10, 5, GObject.ParamFlags.READABLE),
        )).toThrow();
});

test("fundamental arguments reject values that carry no native handle", () => {
    // @ts-expect-error a plain object is not a TestFundamentalObject
    expect(() => Regress.testFundamentalArgumentIn({})).toThrow();
    // @ts-expect-error a number is not a TestFundamentalObject
    expect(() => Regress.testFundamentalArgumentIn(42)).toThrow();
    // @ts-expect-error a string is not a TestFundamentalObject
    expect(() => Regress.testFundamentalArgumentIn("nope")).toThrow();
    // @ts-expect-error a symbol is not a TestFundamentalObject
    expect(() => Regress.testFundamentalArgumentIn(Symbol("nope"))).toThrow();
    // @ts-expect-error a plain object is not a TestFundamentalObject
    expect(() => Regress.testFundamentalArgumentOut({})).toThrow();
    // @ts-expect-error a number is not a TestFundamentalObject
    expect(() => Regress.testFundamentalArgumentOut(0)).toThrow();
});

test("fundamental arrays reject elements that carry no native handle", () => {
    // @ts-expect-error a plain object is not a TestFundamentalObject element
    expect(() => Regress.testArrayOfFundamentalObjectsIn([{}])).toThrow();
    // @ts-expect-error a number is not a TestFundamentalObject element
    expect(() => Regress.testArrayOfFundamentalObjectsIn([1, 2])).toThrow();
    // @ts-expect-error a string is not a TestFundamentalObject element
    expect(() => Regress.testArrayOfFundamentalObjectsIn(["a"])).toThrow();
    // @ts-expect-error a plain object is not a TestFundamentalObject element
    expect(() => Regress.testArrayOfFundamentalObjectsIn([Regress.TestFundamentalSubObject.new("a"), {}])).toThrow();
});

test("fundamental constructors reject data that is not a string", () => {
    // @ts-expect-error a number is not fundamental data
    expect(() => Regress.TestFundamentalSubObject.new(42)).toThrow();
    // @ts-expect-error a plain object is not fundamental data
    expect(() => Regress.TestFundamentalObjectNoGetSetFunc.new({})).toThrow();
    // @ts-expect-error a symbol is not fundamental data
    expect(() => Regress.TestFundamentalSubObjectNoGetSetFunc.new(Symbol("nope"))).toThrow();
});

test("fundamental types are not constructible with new", () => {
    const fundamentalClasses: (new (props: object) => object)[] = [
        // @ts-expect-error TestFundamentalObject is abstract
        Regress.TestFundamentalObject,
        // @ts-expect-error TestFundamentalSubObject is abstract
        Regress.TestFundamentalSubObject,
        // @ts-expect-error TestFundamentalObjectNoGetSetFunc is abstract
        Regress.TestFundamentalObjectNoGetSetFunc,
        // @ts-expect-error TestFundamentalSubObjectNoGetSetFunc is abstract
        Regress.TestFundamentalSubObjectNoGetSetFunc,
        // @ts-expect-error ParamSpecInt is abstract
        GObject.ParamSpecInt,
    ];

    for (const FundamentalClass of fundamentalClasses) {
        expect(() => new FundamentalClass({})).toThrow();
    }
});

test("fundamental instances still come from their own constructors", () => {
    const sub = Regress.TestFundamentalSubObject.new("payload");
    expect(sub instanceof Regress.TestFundamentalObject).toBeTruthy();

    const plain = Regress.TestFundamentalObjectNoGetSetFunc.new("payload");
    expect(plain.getData()).toBe("payload");

    const spec = GObject.paramSpecInt("count", null, null, 0, 10, 5, GObject.ParamFlags.READABLE);
    expect(spec instanceof GObject.ParamSpecInt).toBeTruthy();
    expect(spec.getName()).toBe("count");
});

test("initializing a GValue rejects instances that carry no native handle", () => {
    expect(() => {
        // @ts-expect-error a plain object is not a GTypeInstance
        new GObject.Value().initFromInstance({});
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a GTypeInstance
        new GObject.Value().initFromInstance(7);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not a GTypeInstance
        new GObject.Value().initFromInstance("nope");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not a GTypeInstance
        new GObject.Value().initFromInstance(Symbol("nope"));
    }).toThrow();
});
