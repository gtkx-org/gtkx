import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import * as Utility from "@gtkx/gi/utility";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

GIMarshallingTests.Object.noneReturn();
GIMarshallingTests.Object.noneOut();

drainAfterEachTest();

test("marshalling objects construct with their int property", () => {
    const built = GIMarshallingTests.Object.new(42);
    expect(built.int).toBe(42);
    expect(built instanceof GIMarshallingTests.Object).toBeTruthy();
    built.method();

    const fromProps = new GIMarshallingTests.Object({ int: 42 });
    expect(fromProps.int).toBe(42);
    fromProps.method();

    const fresh = new GIMarshallingTests.Object({});
    expect(fresh.int).toBe(0);
    fresh.overriddenMethod();

    GIMarshallingTests.Object.staticMethod();
});

test("object methods marshal scalars and arrays through the instance", () => {
    const obj = GIMarshallingTests.Object.new(0);
    obj.methodWithDefaultImplementation(42);
    expect(obj.int).toBe(42);

    obj.methodArrayIn([-1, 0, 1, 2]);
    expect(obj.methodArrayOut()).toEqual([-1, 0, 1, 2]);
    expect(obj.methodArrayReturn()).toEqual([-1, 0, 1, 2]);

    obj.int = 7;
    expect(obj.int).toBe(7);
});

test("transfer none returns the same instance and transfer full returns fresh ones", () => {
    const noneFirst = GIMarshallingTests.Object.noneReturn();
    const noneSecond = GIMarshallingTests.Object.noneReturn();
    expect(noneFirst).toBe(noneSecond);
    expect(noneFirst.int).toBe(0);

    const outFirst = GIMarshallingTests.Object.noneOut();
    const outSecond = GIMarshallingTests.Object.noneOut();
    expect(outFirst).toBe(outSecond);
    expect(outFirst.int).toBe(0);
    expect(outFirst).not.toBe(noneFirst);

    const fullFirst = GIMarshallingTests.Object.fullReturn();
    const fullSecond = GIMarshallingTests.Object.fullReturn();
    expect(fullFirst).not.toBe(fullSecond);
    expect(fullFirst.int).toBe(0);
    expect(fullSecond.int).toBe(0);

    expect(GIMarshallingTests.Object.fullOut()).not.toBe(GIMarshallingTests.Object.fullOut());

    GIMarshallingTests.Object.new(42).noneIn();

    expect(GIMarshallingTests.Object.noneOutUninitialized()).toEqual([false, null]);
    expect(GIMarshallingTests.Object.fullOutUninitialized()).toEqual([false, null]);
});

test("subclass instances pass wherever the parent type is expected", () => {
    const sub = new GIMarshallingTests.SubObject({});
    expect(sub instanceof GIMarshallingTests.SubObject).toBeTruthy();
    expect(sub instanceof GIMarshallingTests.Object).toBeTruthy();
    sub.subMethod();
    sub.overwrittenMethod();
    sub.overriddenMethod();
    sub.int = 42;
    sub.method();
    sub.noneIn();

    const subSub = new GIMarshallingTests.SubSubObject({});
    expect(subSub instanceof GIMarshallingTests.SubObject).toBeTruthy();
    expect(subSub instanceof GIMarshallingTests.Object).toBeTruthy();
    subSub.subMethod();
    subSub.methodWithDefaultImplementation(42);
    expect(subSub.int).toBe(42);
    subSub.method();
});

test("objects construct through each constructor", () => {
    const fromProps = new Regress.TestObj({ int: 42, string: "hello" });
    expect(fromProps.int).toBe(42);
    expect(fromProps.string).toBe("hello");
    expect(fromProps instanceof Regress.TestObj).toBeTruthy();
    expect(fromProps instanceof GObject.Object).toBeTruthy();

    const fromNew = Regress.TestObj.new(fromProps);
    expect(fromNew instanceof Regress.TestObj).toBeTruthy();
    expect(fromNew).not.toBe(fromProps);
    expect(fromNew.int).toBe(0);

    const fromFile = Regress.TestObj.newFromFile("/anything");
    expect(fromFile instanceof Regress.TestObj).toBeTruthy();
    expect(fromFile).not.toBe(fromNew);
});

test("object instance and static methods return their documented values", () => {
    const obj = new Regress.TestObj({});
    expect(obj.instanceMethod()).toBe(-1);
    expect(Regress.TestObj.staticMethod(7)).toBe(7);

    obj.setString("data");
    expect(obj.getString()).toBe("data");
    expect(obj.string).toBe("data");

    obj.instanceMethodFull();
    expect(obj.instanceMethod()).toBe(-1);
});

test("torture signatures return every out value", () => {
    const obj = new Regress.TestObj({});
    expect(obj.tortureSignature0(42, "foo", 7)).toEqual([42, 84, 10]);
    expect(obj.tortureSignature1(42, "foo", 6)).toEqual([true, 42, 84, 9]);
});

test("nullable object arguments accept null and compatible objects", () => {
    Regress.funcObjNullIn(null);
    Regress.funcObjNullableIn(null);

    const obj = new Regress.TestObj({});
    Regress.funcObjNullableIn(obj);
    expect(Regress.TestObj.nullOut()).toBeNull();

    expect(obj.bare).toBeNull();
    const companion = new Utility.Object({});
    expect(companion instanceof GObject.Object).toBeTruthy();
    obj.setBare(companion);
    expect(obj.bare).toBe(companion);
    obj.setBare(null);
    expect(obj.bare).toBeNull();
});

test("floating references are sunk on construction", () => {
    const floating = Regress.TestFloating.new();
    expect(floating instanceof Regress.TestFloating).toBeTruthy();
    expect(floating instanceof GObject.InitiallyUnowned).toBeTruthy();

    const fromProps = new Regress.TestFloating({});
    expect(fromProps instanceof Regress.TestFloating).toBeTruthy();
    expect(fromProps).not.toBe(floating);
});

test("a list store hands back the identical wrapper it was given", () => {
    const store = Gio.ListStore.new(Regress.TestObj);
    const item = new Regress.TestObj({ int: 5 });
    store.append(item);
    expect(store.getItem(0)).toBe(item);
    expect(store.getItem(0)).toBe(store.getItem(0));
    expect((store.getItem(0) as Regress.TestObj).int).toBe(5);
});

test("object arguments reject values of the wrong type", () => {
    expect(() => {
        // @ts-expect-error a plain object is not a TestObj
        Regress.funcObjNullIn({});
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not a TestObj
        Regress.funcObjNullIn("nope");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not a TestObj
        Regress.funcObjNullIn(Symbol("nope"));
    }).toThrow();
    // @ts-expect-error the constructor argument is not nullable
    expect(() => Regress.TestObj.new(null)).toThrow();
    expect(() => GIMarshallingTests.Object.new(1.5)).toThrow();
    // @ts-expect-error the int property takes a number, not a string
    expect(() => new GIMarshallingTests.Object({ int: "nope" })).toThrow();
});

test("an object argument rejects an instance of an unrelated type", () => {
    expect(() => {
        // @ts-expect-error a Utility.Object is not a TestObj
        Regress.funcObjNullIn(new Utility.Object({}));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a boxed struct is not a TestObj
        Regress.funcObjNullIn(new GIMarshallingTests.BoxedStruct({ long: 42n }));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a TestBoxed is not a TestObj
        Regress.funcObjNullIn(Regress.TestBoxed.new());
    }).toThrow();
});

test("an object argument still accepts null, subclasses and interface implementers", () => {
    Regress.funcObjNullIn(null);
    Regress.funcObjNullIn(new Regress.TestObj({}));
    Regress.funcObjNullIn(new Regress.TestSubObj({}));

    const implementer = new GIMarshallingTests.InterfaceImpl({});
    const asInterface = implementer.getAsInterface();

    asInterface.testInt8In(42);

    const holder = new Regress.TestObj({});
    holder.setBare(new GObject.Object({}));
    expect(holder.bare instanceof GObject.Object).toBeTruthy();
});

test("object calls surface native errors as exceptions", () => {
    expect(() => GIMarshallingTests.Object.newFail(42)).toThrow();

    const obj = new Regress.TestObj({});
    expect(() => obj.tortureSignature1(42, "foo", 7)).toThrow();

    expect(() => {
        GIMarshallingTests.Object.new(42).fullIn();
    }).toThrow();
});
