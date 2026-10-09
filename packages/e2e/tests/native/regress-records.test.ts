import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import * as Utility from "@gtkx/gi/utility";
import { alloc, getClassType, getHandle, wrapHandle } from "@gtkx/runtime";
import { expect, test } from "vitest";

test("scanner record fields read and write caller-allocated memory", () => {
    const fields = wrapHandle(alloc(32), Regress.AnnotationFields);
    fields.field1 = -42;
    fields.len = 17n;
    fields.field4 = 2 ** 32 - 1;
    expect([fields.field1, fields.len, fields.field4]).toEqual([-42, 17n, 2 ** 32 - 1]);
    const anonymous = wrapHandle(alloc(4), Regress.AnAnonymousUnion);
    anonymous.x = 123;
    expect(anonymous.x).toBe(123);
    const nested = wrapHandle(alloc(4), Regress.AnonymousUnionAndStruct);
    nested.x = -123;
    expect(nested.x).toBe(-123);
    const privateFields = wrapHandle(alloc(12), Regress.TestPrivateStruct);
    privateFields.thisIsPublicBefore = 11;
    privateFields.thisIsPublicAfter = 22;
    expect([privateFields.thisIsPublicBefore, privateFields.thisIsPublicAfter]).toEqual([11, 22]);
    const schema = wrapHandle(alloc(528), Regress.LikeGnomeKeyringPasswordSchema);
    schema.dummy = 42;
    schema.dummy2 = 2.5;
    expect([schema.dummy, schema.dummy2]).toEqual([42, 2.5]);
});

test("boxed rectangles and plain rectangles preserve their native no-op method behavior", () => {
    const boxed = new Regress.FooBRect({ x: 1, y: 2 });
    const other = Regress.FooBRect.new(3, 4);
    boxed.add(other);
    boxed.x = 5;
    boxed.y = 6;
    expect([boxed.x, boxed.y, other.x, other.y]).toEqual([5, 6, 3, 4]);
    const rectangle = new Regress.FooRectangle({ x: 1, y: 2, width: 3, height: 4 });
    rectangle.add(new Regress.FooRectangle({ x: 10, y: 20, width: 30, height: 40 }));
    expect([rectangle.x, rectangle.y, rectangle.width, rectangle.height]).toEqual([1, 2, 3, 4]);
    rectangle.x = 10;
    rectangle.y = 20;
    rectangle.width = 30;
    rectangle.height = 40;
    expect([rectangle.x, rectangle.y, rectangle.width, rectangle.height]).toEqual([10, 20, 30, 40]);
});

test("opaque boxed types use their declared lifecycle and report unavailable methods", () => {
    const boxed = Regress.FooBoxed.new();
    expect(boxed.method()).toBeUndefined();
    const data = wrapHandle(alloc(8, getClassType(Regress.FooDBusData)), Regress.FooDBusData);
    expect(() => data.method()).toThrow("regress_foo_dbus_data_method");
});

test("record field updates survive native copy operations", () => {
    const b = Regress.TestBoxedB.new(1, 2n);
    b.someInt8 = 12;
    expect(b.copy().someInt8).toBe(12);
    const c = Regress.TestBoxedC.new();
    c.anotherThing = 42;
    expect(c.anotherThing).toBe(42);
    const simple = new Regress.TestSimpleBoxedA({});
    simple.someInt8 = 12;
    simple.someEnum = Regress.TestEnum.VALUE2;
    expect([simple.copy().someInt8, simple.copy().someEnum]).toEqual([12, Regress.TestEnum.VALUE2]);
    const a = new Regress.TestStructA({});
    a.someInt8 = 34;
    a.someDouble = 2.5;
    expect([a.clone().someInt8, a.clone().someDouble]).toEqual([34, 2.5]);
    const nested = new Regress.TestStructB({});
    nested.someInt8 = 56;
    nested.nestedA = a;
    expect([nested.clone().someInt8, nested.clone().nestedA.someDouble]).toEqual([56, 2.5]);
});

test("union record variants alias the same native storage", () => {
    const any = new Regress.FooEventAny({ sendEvent: 1 });
    any.sendEvent = 2;
    const expose = new Regress.FooEventExpose({ sendEvent: 3, count: 4 });
    expose.sendEvent = 5;
    expose.count = 6;
    expect([any.sendEvent, expose.sendEvent, expose.count]).toEqual([2, 5, 6]);
    const event = new Regress.FooEvent({ any });
    event.type = 42;
    expect(event.type).toBe(42);
    event.any = any;
    expect(event.any.sendEvent).toBe(2);
    event.expose = expose;
    expect([event.expose.sendEvent, event.expose.count]).toEqual([5, 6]);
    const rectangle = Regress.FooBRect.new(7, 8);
    expect(new Regress.FooBUnion({ type: 42 }).type).toBe(42);
    const union = wrapHandle(alloc(8), Regress.FooBUnion);
    union.rect = rectangle;
    expect([union.rect.x, union.rect.y]).toEqual([7, 8]);
    rectangle.x = 99;
    expect(union.rect.x).toBe(7);
});

test("foreign records copy their scalar field", () => {
    const initialized = new Regress.FooForeignStruct({ regressFoo: 12 });
    initialized.regressFoo = 23;
    const original = Regress.FooForeignStruct.new();
    original.regressFoo = 42;
    const copy = original.copy();
    original.regressFoo = 13;
    expect([initialized.regressFoo, original.regressFoo, copy.regressFoo]).toEqual([23, 13, 42]);
});

test("fixed character arrays maintain their bounds and null termination", () => {
    const array = wrapHandle(alloc(88), Regress.FooThingWithArray);
    array.x = 1;
    array.y = 2;
    array.lines = Int8Array.from({ length: 80 }, (_, index) => index);
    expect([array.x, array.y]).toEqual([1, 2]);
    expect(array.lines).toEqual(Array.from({ length: 80 }, (_, index) => index));
    const item = new Regress.LikeXklConfigItem({});
    item.setName("native");
    expect(Buffer.from(item.name).subarray(0, 7).toString()).toBe("native\0");
    const data = new Int8Array(item.name.length);
    data.set(Buffer.from("updated"));
    item.name = data;
    expect(Buffer.from(item.name).subarray(0, 8).toString()).toBe("updated\0");
});

test("nested records from another namespace are copied by value", () => {
    const original = new Utility.Struct({ field: 42 });
    const record = new Regress.FooUtilityStruct({ bar: original });
    record.bar = original;
    original.field = 23;
    expect(record.bar.field).toBe(42);
});

test("reference count typedefs preserve scalar field access", () => {
    const counters = new Regress.TestReferenceCounters({ refcount: 1, atomicrefcount: 2 });
    counters.refcount = 3;
    counters.atomicrefcount = 4;
    expect([counters.refcount, counters.atomicrefcount]).toEqual([3, 4]);
});

test("pointer record fields retain their native wrappers", () => {
    const c = wrapHandle(alloc(16), Regress.TestStructC);
    const object = new GObject.Object({});
    c.anotherInt = 42;
    c.obj = object;
    expect(c.anotherInt).toBe(42);
    expect(c.obj).toBe(object);
    const d = wrapHandle(alloc(40), Regress.TestStructD);
    const testObject = new Regress.TestObj({});
    d.field = testObject;
    expect(d.field).toBe(testObject);
    expect(d.array1).toEqual([]);
    const e = wrapHandle(alloc(24), Regress.TestStructE);
    e.someType = GObject.Object;
    expect(e.someType).toBe(getClassType(GObject.Object));
    const f = wrapHandle(alloc(64), Regress.TestStructF);
    f.refCount = 3;
    f.data7 = 255;
    expect([f.refCount, f.data7]).toEqual([3, 255]);
    const foo = wrapHandle(alloc(16), Regress.FooStruct);
    const privateRecord = wrapHandle(alloc(1), Regress.FooStructPrivate);
    foo.priv = privateRecord;
    foo.member = 42;
    expect(foo.member).toBe(42);
    expect(foo.priv).toBeInstanceOf(Regress.FooStructPrivate);
});

test("anonymous union numeric variants share their native representation", () => {
    const value = wrapHandle(alloc(8), Regress.TestStructE__some_union__union);
    value.vInt = -1;
    expect(value.vInt).toBe(-1);
    value.vUint = 2 ** 32 - 1;
    expect(value.vUint).toBe(2 ** 32 - 1);
    value.vLong = -42n;
    expect(value.vLong).toBe(-42n);
    value.vUlong = 42n;
    expect(value.vUlong).toBe(42n);
    value.vInt64 = -(2n ** 63n);
    expect(value.vInt64).toBe(-(2n ** 63n));
    value.vUint64 = 2n ** 64n - 1n;
    expect(value.vUint64).toBe(2n ** 64n - 1n);
    value.vFloat = 1.5;
    expect(value.vFloat).toBe(1.5);
    value.vDouble = 2.5;
    expect(value.vDouble).toBe(2.5);
});

test("class and interface records come from registered native types", () => {
    const objectClass = wrapHandle(getHandle(GObject.ObjectClass.peek(Regress.TestObj)), Regress.TestObjClass);
    expect(objectClass.testSignal).toBe(GObject.signalLookup("test", Regress.TestObj));
    expect(objectClass.testSignalWithStaticScopeArg).toBe(
        GObject.signalLookup("test-with-static-scope-arg", Regress.TestObj),
    );
    const fundamentalClass = wrapHandle(
        getHandle(GObject.TypeClass.get(Regress.TestFundamentalObject)),
        Regress.TestFundamentalObjectClass,
    );
    expect(fundamentalClass.typeClass).toBeInstanceOf(GObject.TypeClass);
    const fooInterface = wrapHandle(
        getHandle(GObject.typeDefaultInterfaceGet(Regress.FooInterface)),
        Regress.FooInterfaceIface,
    );
    expect(fooInterface.parentIface).toBeInstanceOf(GObject.TypeInterface);
    const fooSubInterface = wrapHandle(
        getHandle(GObject.typeDefaultInterfaceGet(Regress.FooSubInterface)),
        Regress.FooSubInterfaceIface,
    );
    expect(fooSubInterface.parentIface).toBeInstanceOf(GObject.TypeInterface);
    const testInterface = wrapHandle(
        getHandle(GObject.typeDefaultInterfaceGet(Regress.TestInterface)),
        Regress.TestInterfaceIface,
    );
    expect(testInterface.baseIface).toBeInstanceOf(GObject.TypeInterface);
});
