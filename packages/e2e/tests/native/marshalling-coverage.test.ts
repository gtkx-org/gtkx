import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import { callParent, getHandle, registerClass, wrapHandle } from "@gtkx/runtime";
import { expect, test } from "vitest";

test("static constructor slots preserve their first out argument", () => {
    const anchor = new GIMarshallingTests.Object({});
    expect(anchor.int).toBe(0);
    expect(GIMarshallingTests.Object.vfuncStaticCreateNew(GIMarshallingTests.Object, 17).int).toBe(17);
    expect(GIMarshallingTests.Object.vfuncStaticCreateNewOut(GIMarshallingTests.Object, 19).int).toBe(19);

    class StaticFactory extends GIMarshallingTests.Object {
        override vfuncVfuncStaticCreateNewOut(value: number): GIMarshallingTests.Object {
            return new GIMarshallingTests.Object({ int: value * 2 });
        }
    }

    const Registered = registerClass(StaticFactory, { typeName: `GtkxStaticFactory${String(process.pid)}` });
    const instance = new Registered({});
    expect(instance.int).toBe(0);
    expect(GIMarshallingTests.Object.vfuncStaticCreateNewOut(Registered, 23).int).toBe(46);
    class StaticInvoker extends StaticFactory {
        createThroughParent(value: number): unknown {
            return callParent(StaticInvoker, "vfuncVfuncStaticCreateNewOut", this, value);
        }
    }
    const Invoker = registerClass(StaticInvoker, { typeName: `GtkxStaticInvoker${String(process.pid)}` });
    expect(new Invoker({}).createThroughParent(31)).toHaveProperty("int", 62);
});

test("the default callback invoker accepts a call-scoped callback without invoking it", () => {
    const seen: number[] = [];
    class CallbackReceiver extends GIMarshallingTests.Object {
        override vfuncVfuncWithCallback(callback: GIMarshallingTests.CallbackIntInt): void {
            seen.push(callback(12));
        }
    }
    const Registered = registerClass(CallbackReceiver, { typeName: `GtkxCallbackReceiver${String(process.pid)}` });
    new Registered({}).vfuncWithCallback((value) => value + 4);
    expect(seen).toEqual([]);
});

test("declared methods with missing upstream implementations report their native symbol", () => {
    const instance = new GIMarshallingTests.Object({});
    expect(() => instance.methodVariantArrayIn(GLib.Variant.newInt32(1), 1)).toThrow(
        "gi_marshalling_tests_object_method_variant_array_in",
    );
});

test("boxed pointer array constructors expose their live reference count", () => {
    const value = GIMarshallingTests.PointerArrayStruct.withUint8Array();
    expect(value.refCount).toBe(1);
    value.refCount = value.refCount + 1;
    expect(value.refCount).toBe(2);
    value.refCount = 1;
});

test("single-type unions alias their inline struct members", () => {
    const value = new GIMarshallingTests.StructuredUnionSingleType({});
    value.simpleStruct1 = new GIMarshallingTests.StructuredUnionSimpleStruct({
        type: GIMarshallingTests.StructuredUnionType.SIMPLE_STRUCT,
        parent: new GIMarshallingTests.SimpleStruct({ long: 42n, int8: 7 }),
    });
    expect(value.simpleStruct2.parent.long).toBe(42n);
    expect(value.simpleStruct1.parent.int8).toBe(7);
    value.simpleStruct2 = new GIMarshallingTests.StructuredUnionSimpleStruct({
        type: GIMarshallingTests.StructuredUnionType.SIMPLE_STRUCT,
        parent: new GIMarshallingTests.SimpleStruct({ long: -9n, int8: -3 }),
    });
    expect(value.simpleStruct1.parent.long).toBe(-9n);
    expect(value.simpleStruct2.parent.int8).toBe(-3);
});

test("interface records expose their registered base interface type", () => {
    const first = wrapHandle(
        getHandle(GObject.typeDefaultInterfaceGet(GIMarshallingTests.Interface)),
        GIMarshallingTests.InterfaceIface,
    );
    const second = wrapHandle(
        getHandle(GObject.typeDefaultInterfaceGet(GIMarshallingTests.Interface2)),
        GIMarshallingTests.Interface2Iface,
    );
    const third = wrapHandle(
        getHandle(GObject.typeDefaultInterfaceGet(GIMarshallingTests.Interface3)),
        GIMarshallingTests.Interface3Iface,
    );
    expect(first.baseIface).toBeInstanceOf(GObject.TypeInterface);
    expect(second.baseIface).toBeInstanceOf(GObject.TypeInterface);
    expect(third.baseIface).toBeInstanceOf(GObject.TypeInterface);
});

test.each([
    ["PropertiesObject", () => new GIMarshallingTests.PropertiesObject({})],
    ["PropertiesAccessorsObject", () => GIMarshallingTests.PropertiesAccessorsObject.new()],
])("%s collection properties preserve values and issue detailed notifications", (_name, create) => {
    const instance = create();
    const seen: string[] = [];
    instance.connect("notify::some-boxed-glist", (spec) => seen.push(spec.getName()));
    instance.connect("notify::some-hash-table", (spec) => seen.push(spec.getName()));
    instance.someBoxedGlist = [-1, 0, 2];
    expect(instance.someBoxedGlist).toEqual([-1, 0, 2]);
    instance.someHashTable = new Map([[4, "four"]]);
    expect(instance.someHashTable).toEqual(new Map([[4, "four"]]));
    expect(seen).toEqual(["some-boxed-glist", "some-hash-table"]);
    instance.someHashTable = null;
    expect(instance.someHashTable).toBeNull();
});

test("override fixture records and objects preserve their native constructors and methods", () => {
    for (const value of [
        new GIMarshallingTests.OverridesStruct({ long: 3n }),
        GIMarshallingTests.OverridesStruct.new(),
        GIMarshallingTests.OverridesStruct.returnv(),
    ]) {
        expect(value.method()).toBe(42n);
        value.long = 9n;
        expect(value.long).toBe(9n);
    }
    expect(GIMarshallingTests.OverridesObject.new().method()).toBe(42n);
    expect(GIMarshallingTests.OverridesObject.returnv().method()).toBe(42n);
    expect(GIMarshallingTests.PropertiesObject.new().someReadonly).toBe(42);
});

test("each structured union record preserves its tagged inline and pointer fields", () => {
    const type = GIMarshallingTests.StructuredUnionType;
    const simple = new GIMarshallingTests.StructuredUnionSimpleStruct({});
    simple.type = type.SIMPLE_STRUCT;
    simple.parent = new GIMarshallingTests.SimpleStruct({ long: 6n, int8: 7 });
    expect(simple.type).toBe(type.SIMPLE_STRUCT);
    expect(simple.parent.long).toBe(6n);
    const nested = new GIMarshallingTests.StructuredUnionNestedStruct({});
    nested.type = type.NESTED_STRUCT;
    nested.parent = new GIMarshallingTests.NestedStruct({ simpleStruct: simple.parent });
    expect(nested.type).toBe(type.NESTED_STRUCT);
    expect(nested.parent.simpleStruct.int8).toBe(7);
    const pointer = new GIMarshallingTests.StructuredUnionPointerStruct({});
    pointer.type = type.POINTER_STRUCT;
    pointer.parent = new GIMarshallingTests.PointerStruct({ long: 12n });
    expect(pointer.type).toBe(type.POINTER_STRUCT);
    expect(pointer.parent.long).toBe(12n);
    const boxed = wrapHandle(
        getHandle(GIMarshallingTests.StructuredUnion.new(type.BOXED_STRUCT)),
        GIMarshallingTests.StructuredUnionBoxedStruct,
    );
    boxed.type = type.BOXED_STRUCT;
    expect(boxed.type).toBe(type.BOXED_STRUCT);
    const boxedPointer = wrapHandle(
        getHandle(GIMarshallingTests.StructuredUnion.new(type.NONE)),
        GIMarshallingTests.StructuredUnionBoxedStructPtr,
    );
    boxedPointer.type = type.BOXED_STRUCT_PTR;
    boxedPointer.parent = new GIMarshallingTests.BoxedStruct({ long: 18n });
    expect(boxedPointer.type).toBe(type.BOXED_STRUCT_PTR);
    expect(boxedPointer.parent.long).toBe(18n);
    const union = new GIMarshallingTests.StructuredUnionUnionStruct({});
    union.type = type.SINGLE_UNION;
    union.union = new GIMarshallingTests.Union({ long: -5n });
    expect(union.type).toBe(type.SINGLE_UNION);
    expect(union.union.long).toBe(-5n);
    const single = new GIMarshallingTests.StructuredUnionSingleUnion({});
    single.parent = union;
    expect(single.parent.union.long).toBe(-5n);
    const singleType = new GIMarshallingTests.StructuredUnionSingleType({});
    singleType.type = type.SIMPLE_STRUCT;
    expect(singleType.type).toBe(type.SIMPLE_STRUCT);
    for (const tag of [type.BOXED_STRUCT, type.BOXED_STRUCT_PTR, type.SINGLE_UNION]) {
        expect(GIMarshallingTests.StructuredUnion.new(tag).type()).toBe(tag);
    }
});

test("chaining into unimplemented native slots reports errors without invoking null pointers", () => {
    class EmptyParent extends GIMarshallingTests.Object {
        checks(): Array<() => unknown> {
            const value = new GObject.Value();
            value.init(GObject.typeFromName("gint"));
            const object = new GObject.Object({});
            return [
                () => super.vfuncMethodInt8In(1),
                () => super.vfuncMethodInt8Out(),
                () => super.vfuncMethodInt8ArgAndOutCaller(1),
                () => super.vfuncMethodStrArgOutRet("input"),
                () => super.vfuncVfuncWithCallback((input) => input),
                () => super.vfuncVfuncReturnValueOnly(),
                () => super.vfuncVfuncOneOutParameter(),
                () => super.vfuncVfuncMultipleOutParameters(),
                () => super.vfuncVfuncOneInoutParameter(1),
                () => super.vfuncVfuncMultipleInoutParameters(1, 2),
                () => super.vfuncVfuncCallerAllocatedOutParameter(value),
                () => super.vfuncVfuncArrayOutParameter(),
                () => super.vfuncVfuncReturnValueAndOneOutParameter(),
                () => super.vfuncVfuncReturnValueAndMultipleOutParameters(),
                () => super.vfuncVfuncReturnValueAndOneInoutParameter(1n),
                () => super.vfuncVfuncReturnValueAndMultipleInoutParameters(1n, 2n),
                () => super.vfuncVfuncMethWithErr(1),
                () => super.vfuncVfuncReturnEnum(),
                () => super.vfuncVfuncOutEnum(),
                () => super.vfuncVfuncReturnObjectTransferNone(),
                () => super.vfuncVfuncReturnObjectTransferFull(),
                () => super.vfuncVfuncOutObjectTransferNone(),
                () => super.vfuncVfuncOutObjectTransferFull(),
                () => super.vfuncVfuncInObjectTransferNone(object),
                () => super.vfuncVfuncInObjectTransferFull(object),
                () => super.vfuncVfuncReturnFlags(),
                () => super.vfuncVfuncOutFlags(),
                () => super.vfuncVfuncStaticName(),
                () => super.vfuncVfuncStaticCreateNewOut(1),
            ];
        }
    }
    const Registered = registerClass(EmptyParent, { typeName: `GtkxEmptyParent${String(process.pid)}` });
    for (const call of new Registered({}).checks()) {
        expect(call).toThrow("provides no implementation");
    }
});

const propertySnapshot = (value: unknown): unknown => {
    if (value instanceof GIMarshallingTests.BoxedStruct) return value.long;
    if (value instanceof GObject.Value) return value.getInt();
    if (value instanceof GLib.Variant) return value.getString()[0];
    return value;
};

test.each([
    ["PropertiesObject", () => new GIMarshallingTests.PropertiesObject({})],
    ["PropertiesAccessorsObject", () => GIMarshallingTests.PropertiesAccessorsObject.new()],
])("%s accessors preserve each property type and notify its native name", (_name, create) => {
    const instance = create();
    const value = new GObject.Value();
    value.init(GObject.typeFromName("gint"));
    value.setInt(37);
    const properties = {
        someBoolean: true,
        someChar: -7,
        someUchar: 8,
        someInt: 9,
        someUint: 10,
        someLong: -11n,
        someUlong: 12n,
        someInt64: -13n,
        someUint64: 14n,
        someFloat: 0.5,
        someDouble: 1.5,
        someString: "text",
        someStrv: ["one", "two"],
        someBoxedStruct: new GIMarshallingTests.BoxedStruct({ long: 17n }),
        someGvalue: value,
        someVariant: GLib.Variant.newString("variant"),
        someObject: new GObject.Object({}),
        someFlags: GIMarshallingTests.Flags.VALUE2,
        someEnum: GIMarshallingTests.GEnum.VALUE3,
        someByteArray: new Uint8Array([1, 2, 255]),
        someDeprecatedInt: 18,
    };
    const seen: string[] = [];
    for (const [name, input] of Object.entries(properties)) {
        const nativeName = name.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        instance.connect(`notify::${nativeName}` as keyof GIMarshallingTests.PropertiesObjectSignals, (spec) =>
            seen.push(spec.getName()),
        );
        Reflect.set(instance, name, input);
        expect(propertySnapshot(Reflect.get(instance, name))).toEqual(propertySnapshot(input));
        expect(seen.at(-1)).toBe(nativeName);
    }
    instance.connect("notify::some-readonly", (spec) => seen.push(spec.getName()));
    instance.notify("some-readonly");
    expect(seen.at(-1)).toBe("some-readonly");
    expect(instance.someReadonly).toBe(42);
});

test("object properties issue their detailed notification", () => {
    const instance = new GIMarshallingTests.Object({});
    const seen: string[] = [];
    instance.connect("notify::int", (spec) => seen.push(spec.getName()));
    instance.int = 7;
    expect(instance.int).toBe(7);
    expect(seen).toEqual(["int"]);
});

test("interface vfunc proxies call native implementations and reject empty interface slots", () => {
    const native = new GIMarshallingTests.InterfaceImpl({}).getAsInterface();
    native.vfuncTestInt8In(42);
    expect(native).toBeInstanceOf(GIMarshallingTests.Interface);
    class EmptyInterfaces extends GObject.Object {}
    const Registered = registerClass(EmptyInterfaces, {
        typeName: `GtkxEmptyInterfaces${String(process.pid)}`,
        implements: [GIMarshallingTests.Interface2, GIMarshallingTests.Interface3],
    });
    const instance = new Registered({});
    if (!(instance instanceof GIMarshallingTests.Interface2) || !(instance instanceof GIMarshallingTests.Interface3)) {
        throw new Error("The registered object must implement both interfaces");
    }
    expect(() => instance.vfuncTestInt8In(7)).toThrow("provides no implementation");
    expect(() => instance.vfuncTestVariantArrayIn([GLib.Variant.newInt32(5)])).toThrow("provides no implementation");
});
