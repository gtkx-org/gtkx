import * as Cairo from "@gtkx/cairo";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import * as Utility from "@gtkx/gi/utility";
import { alloc, type ExternalObject, type Handle, registerClass, t, wrapHandle } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainGC } from "./helpers/memory.js";

test("annotation list and hash ownership preserves object identity", () => {
    const object = new Regress.AnnotationObject({});
    expect(object.out()).toEqual([1, 2]);
    expect(object.inout(12)).toEqual([13, 13]);
    expect(object.getStrings()).toEqual(["bar", "regress_annotation"]);
    expect(object.getObjects()).toEqual([object]);
    expect(object.getHash()).toEqual(
        new Map([
            ["one", object],
            ["two", object],
        ]),
    );
    expect(object.createObject()).toBe(object);
    expect(object.method()).toBe(1);
});

test("annotation outputs initialize missing values and preserve nullable input", () => {
    const object = new Regress.AnnotationObject({});
    expect(object.inout2(12)).toEqual([13, 13]);
    expect(object.inout3(12)).toEqual([13, 12]);
    expect(object.inout3(null)).toEqual([1, 0]);
    expect(object.calleeowns()).toEqual([1, null]);
    expect(object.calleesowns()).toEqual([1, null, null]);
    expect(object.stringOut()).toEqual([false, null]);
    expect(object.allowNone(null)).toBeNull();
    expect(object.allowNone("present")).toBeNull();
    expect(object.notrans()).toBeNull();
    expect(object.doNotUse()).toBeNull();
});

test("annotation scanner fixtures accept their declared argument forms", () => {
    const object = new Regress.AnnotationObject({});
    const calls: string[] = [];
    object.computeSumN(Int32Array.of(-1, 0, 2));
    object.computeSumNz([1, 2, 3]);
    object.setData(Uint8Array.of(0, 255));
    object.setData2(Int8Array.of(-128, 127));
    object.setData3([0, 255]);
    object.foreach((_object, text) => calls.push(text));
    object.watch((_object, text) => calls.push(text));
    object.extraAnnos();
    object.hiddenSelf();
    expect(calls).toEqual([]);
    expect(Regress.annotationAttributeFunc(object, "data")).toBe(42);
    expect(() => object.setData([256])).toThrow();
});

test("scanner annotation functions preserve native null and void results", () => {
    expect(Regress.annotationGetSourceFile()).toBeNull();
    expect(Regress.annotationReturnArray()).toEqual([]);
    expect(Regress.annotationTestParsingBug630862()).toBeNull();
    expect(Regress.annotationTransferFloating(new GObject.Object({}))).toBeNull();
    expect(Regress.annotationSetSourceFile("café.txt")).toBeUndefined();
    expect(Regress.annotationInvalidRegressAnnotation(12)).toBeUndefined();
    expect(Regress.annotationVersioned()).toBeUndefined();
    expect(Regress.annotationSpaceAfterCommentBug631690()).toBeUndefined();
    expect(Regress.annotationCustomDestroyCleanup()).toBeUndefined();
    expect(Regress.testMultilineDocComments()).toBeUndefined();
    expect(Regress.testNestedParameter(12)).toBeUndefined();
    expect(Regress.testVersioning()).toBeUndefined();
});

test("error-domain functions resolve their native quark names", () => {
    expect(GLib.quarkToString(Regress.atestErrorQuark())).toBe("regress-atest-error");
    expect(GLib.quarkToString(Regress.fooErrorQuark())).toBe("regress_foo-error-quark");
    expect(GLib.quarkToString(Regress.testAbcErrorQuark())).toBe("regress-test-abc-error");
    expect(GLib.quarkToString(Regress.testDefErrorQuark())).toBe("regress-test-def-error");
    expect(GLib.quarkToString(Regress.testErrorQuark())).toBe("regress-test-error");
    expect(GLib.quarkToString(Regress.testUnconventionalErrorQuark())).toBe("regress-test-other-error");
});

test("Foo scanner functions retain native values and accept arrays", () => {
    expect(Regress.fooInit()).toBe(Regress.FOO_SUCCESS_INT);
    expect(Regress.fooInitArgv(["gtkx", "--help"])).toBe(Regress.FOO_SUCCESS_INT);
    expect(Regress.fooInitArgv(null)).toBe(Regress.FOO_SUCCESS_INT);
    expect(Regress.fooEnumMethod(Regress.FooEnumType.ALPHA)).toBe(0);
    expect(Regress.fooNotAConstructorNew()).toBeNull();
    expect(Regress.fooTestArray()).toEqual([]);
    expect(Regress.fooTestStringArray(["one", "two"])).toBeUndefined();
    expect(Regress.fooTestStringArrayWithG(["one", "two"])).toBeUndefined();
    expect(Regress.fooTestUnsigned(2 ** 32 - 1)).toBeUndefined();
    expect(() => Regress.fooTestUnsigned(-1)).toThrow();
});

test("Foo object methods preserve constructors, borrowed results and scalar aliases", () => {
    const object = Regress.FooObject.newAsSuper();
    expect(object).toBeInstanceOf(Regress.FooObject);
    expect(object.dupName()).toBe("regress_foo");
    expect(object.externalType()).toBeNull();
    expect(object.appendNewStackLayer(3)).toBeNull();
    expect(Regress.FooObject.getDefault()).toBeNull();
    expect(Regress.FooObject.staticMeth()).toBe(77);
    expect(Regress.FooObject.aGlobalMethod(new Utility.Object({}))).toBeUndefined();
    expect(object.isItTimeYet(1234567890n)).toBeUndefined();
    expect(object.seek(12n)).toBeUndefined();
    expect(object.handleGlyph(12)).toBeUndefined();
    expect(object.virtualMethod(12)).toBe(false);
    expect(object.read(0, 12)).toBeUndefined();
    expect(object.getName()).toBe("regress_foo");
    expect(Regress.FooObject.new().getName()).toBe("regress_foo");
    expect(new Regress.FooObject({}).getName()).toBe("regress_foo");
    expect(Regress.FooInterface.staticMethod(42)).toBeUndefined();
    object.string = "fixture";
    expect(object.string).toBeNull();
    const buffer = new Regress.FooBuffer({});
    expect(buffer.someMethod()).toBeUndefined();
    expect(buffer).toBeInstanceOf(Regress.FooObject);
});

test("a native virtual method dispatches its differently named slot", () => {
    class Matrix extends Regress.TestObj {
        override vfuncMatrix(text: string): number {
            return super.vfuncMatrix(text) + text.length;
        }
    }
    const Registered = registerClass(Matrix, { typeName: "GtkxRegressMatrixCoverage" });
    const object = new Registered({});
    expect(object.doMatrix("hello")).toBe(47);
    expect(object.forcedMethod()).toBeUndefined();
    expect(object.notNullableTypedGpointerIn(new GObject.Object({}))).toBeUndefined();
    expect(object.notNullableElementTypedGpointerIn(Uint8Array.of(0, 255))).toBeUndefined();
    expect(Regress.TestObj.nullOut()).toBeNull();
});

test("Foo virtual method overrides dispatch through the native instance", () => {
    const seen: number[] = [];
    class Foo extends Regress.FooObject {
        override vfuncVirtualMethod(value: number): boolean {
            seen.push(value);
            return value === 42;
        }
    }
    const Registered = registerClass(Foo, { typeName: "GtkxRegressFooCoverage" });
    const object = new Registered({});
    expect(object.virtualMethod(42)).toBe(true);
    expect(object.virtualMethod(12)).toBe(false);
    expect(seen).toEqual([42, 12]);
});

test("an abstract drawable subclass inherits native outputs and errors", () => {
    class Drawable extends Regress.TestInheritDrawable {}
    const Registered = registerClass(Drawable, { typeName: "GtkxRegressDrawableCoverage" });
    const object = new Registered({});
    expect(object.getOrigin()).toEqual([0, 0]);
    expect(object.getSize()).toEqual([42, 42]);
    expect(object.doFoo(12)).toBeUndefined();
    expect(object.doFooMaybeThrow(42)).toBeUndefined();
    expect(() => object.doFooMaybeThrow(12)).toThrow("The answer should be 42!");
});

test("object async constructors and methods execute their generated finish binding", async () => {
    const pending = Regress.TestObj.newAsync("fixture");
    expect(Regress.TestObj.constructorThawAsync()).toBe(1);
    const object = await pending;
    expect(object).toBeInstanceOf(Regress.TestObj);
    const operation = object.functionAsync(0);
    expect(object.functionThawAsync()).toBe(1);
    await expect(operation).resolves.toBe(true);
    expect(object.functionSync(0)).toBe(true);
    expect(object.function2Sync(0)).toBe(true);
    const completed = new Promise<[boolean, boolean, GObject.Object | null]>((resolve) => {
        object.function2(0, null, null, (_source: GObject.Object | null, result: Gio.AsyncResult) => {
            resolve(object.function2Finish(result));
        });
    });
    expect(object.functionThawAsync()).toBe(1);
    await expect(completed).resolves.toEqual([true, true, null]);
});

test("native property aliases and acronym names retain their behavior", () => {
    const sub = Regress.TestSubObj.new();
    sub.setBare(new GObject.Object({}));
    sub.unsetBare();
    expect(sub.bare).toBeNull();
    const wireless = Regress.TestWi8021x.new();
    wireless.setTestbool(true);
    expect(wireless.getTestbool()).toBe(true);
    expect(wireless.testbool).toBe(true);
    wireless.testbool = false;
    expect(wireless.getTestbool()).toBe(false);
    expect(new Regress.TestWi8021x({ testbool: true }).testbool).toBe(true);
    expect(Regress.TestWi8021x.staticMethod(21)).toBe(42);
    sub.boolean = true;
    expect(sub.boolean).toBe(true);
    const object = new Regress.TestObj({});
    object.double = 2.5;
    expect(object.double).toBe(2.5);
    object.int = 42;
    object.writeOnly = true;
    expect(object.int).toBe(0);
    expect(Regress.getVariant().unpack()).toBe(42);
});

test("native empty virtual slots report unavailable implementations", () => {
    class Foo extends Regress.FooObject {
        nativeSlots(): (() => unknown)[] {
            return [() => super.vfuncVirtualMethod(42), () => super.vfuncReadFn(0, 1)];
        }
    }
    const RegisteredFoo = registerClass(Foo, { typeName: "GtkxRegressEmptyFooSlots" });
    class Object extends Regress.TestObj {
        nativeSlots(): (() => unknown)[] {
            return [
                () => super.vfuncAllowNoneVfunc(null),
                () => super.vfuncStaticVfunc(),
                () => super.vfuncStaticVfuncOut(),
                () => super.vfuncComplexVfunc(42),
            ];
        }
    }
    const RegisteredObject = registerClass(Object, { typeName: "GtkxRegressEmptyObjectSlots" });
    for (const invoke of [...new RegisteredFoo({}).nativeSlots(), ...new RegisteredObject({}).nativeSlots()]) {
        expect(invoke).toThrow("no implementation");
    }
});

test("subinterface methods and its action signal dispatch inherited and new slots", () => {
    const calls: string[] = [];
    class Implementation extends Regress.FooObject implements Regress.FooSubInterfaceImpl {
        declare doBar: Regress.FooSubInterface["doBar"];
        vfuncDoBar(): void {
            calls.push("bar");
        }
        vfuncDoBaz(callback: GObject.Callback): void {
            calls.push("baz");
            callback();
        }
        vfuncDestroyEvent(): void {
            calls.push("destroy");
        }
    }
    const Registered = registerClass(Implementation, {
        typeName: "GtkxRegressSubInterfaceCoverage",
        implements: [Regress.FooSubInterface],
    });
    const object = new Registered({});
    expect(object).toBeInstanceOf(Regress.FooInterface);
    object.doRegressFoo(42);
    object.vfuncDoRegressFoo(42);
    object.doBar();
    object.vfuncDoBar();
    object.vfuncDoBaz(() => calls.push("callback"));
    object.connect("destroy-event", () => calls.push("handler"));
    object.emit("destroy-event");
    expect(calls).toEqual(["bar", "bar", "baz", "callback", "handler", "destroy"]);
});

test("interface mixins dispatch custom implementations and preserve native defaults", () => {
    const values: number[] = [];
    class Implementation extends GObject.Object implements Regress.FooInterfaceImpl {
        declare doRegressFoo: Regress.FooInterface["doRegressFoo"];
        vfuncDoRegressFoo(value: number): void {
            values.push(value);
        }
    }
    const Registered = registerClass(Implementation, {
        typeName: "GtkxRegressFooInterfaceCoverage",
        implements: [Regress.FooInterface],
    });
    new Registered({}).doRegressFoo(42);
    expect(values).toEqual([42]);
    const Base = Regress.makeFooSubInterface(Regress.FooObject) as new (
        props?: Regress.FooObjectConstructorProps,
    ) => Regress.FooObject & Regress.FooSubInterface;
    class EmptySlots extends Base {
        checkNativeDefaults(): void {
            expect(() => super.vfuncDoBar()).toThrow("no implementation");
            expect(() => super.vfuncDoBaz(() => {})).toThrow("no implementation");
            expect(() => super.vfuncDestroyEvent()).toThrow("no implementation");
        }
    }
    const RegisteredEmpty = registerClass(EmptySlots, {
        typeName: "GtkxRegressEmptySubInterfaceCoverage",
        implements: [Regress.FooSubInterface],
    });
    new RegisteredEmpty().checkNativeDefaults();
});

test("interface properties retain values and emit their native notification", () => {
    class Implementation extends GObject.Object {}
    const Registered = registerClass(Implementation, {
        typeName: "GtkxRegressNumberInterfaceCoverage",
        implements: [Regress.TestInterface],
    });
    const object = new Registered({});
    const changes: string[] = [];
    object.connect("notify::number", (spec) => changes.push(spec.name));
    object.number = 7;
    expect(object.number).toBe(7);
    expect(changes).toEqual(["number"]);
    expect(object.emitSignal()).toBeUndefined();
});

test("pointer-array aliases validate borrowed addresses", () => {
    const pointers = [0n, 1n, 0x1234n];
    expect(Regress.introspectableViaAlias(pointers)).toBeUndefined();
    expect(pointers).toEqual([0n, 1n, 0x1234n]);
    expect(() => {
        Reflect.apply(Regress.introspectableViaAlias, undefined, [["invalid"]]);
    }).toThrow(/bigint address/);
});

test("caller-allocated aliases retain their boxed destructor", () => {
    const boxed = Regress.aliasedCallerAlloc();
    expect(boxed).toBeInstanceOf(Regress.TestBoxed);
    expect(boxed.someInt8).toBe(0);
    expect(boxed.copy().equals(boxed)).toBe(true);
});

test.each([
    ["regress_foo_async_ready_callback", () => Regress.fooAsyncReadyCallback(null, null)],
    ["regress_foo_destroy_notify_callback", () => Regress.fooDestroyNotifyCallback(() => true)],
    ["regress_foo_test_const_char_param", () => Regress.fooTestConstCharParam("fixture")],
    ["regress_foo_test_const_char_retval", () => Regress.fooTestConstCharRetval()],
    [
        "regress_foo_test_const_struct_param",
        () => Regress.fooTestConstStructParam(wrapHandle(alloc(16), Regress.FooStruct)),
    ],
    ["regress_foo_test_const_struct_retval", () => Regress.fooTestConstStructRetval()],
    ["regress_foo_test_unsigned_type", () => Regress.fooTestUnsignedType(42)],
    ["regress_set_abort_on_error", () => Regress.setAbortOnError(false)],
] as const)("scanner-only declaration %s reports its missing implementation", (symbol, invoke) => {
    expect(invoke).toThrow(symbol);
});

test("foreign Cairo context and surface ownership survives borrowed and consumed arguments", () => {
    const context = Regress.testCairoContextFullReturn();
    expect(context.status()).toBe(Cairo.Status.SUCCESS);
    Regress.testCairoContextNoneIn(context);
    Regress.testCairoContextNoneIn(Regress.testCairoContextNoneReturn());
    Regress.testCairoContextFullIn(context);
    expect(context.status()).toBe(Cairo.Status.SUCCESS);
    for (const surface of [
        Regress.testCairoSurfaceNoneReturn(),
        Regress.testCairoSurfaceFullReturn(),
        Regress.testCairoSurfaceFullOut(),
    ]) {
        expect(surface.status()).toBe(Cairo.Status.SUCCESS);
        Regress.testCairoSurfaceNoneIn(surface);
        Regress.testCairoSurfaceFullIn(surface);
        expect(surface.status()).toBe(Cairo.Status.SUCCESS);
    }
});

test("foreign Cairo patterns and regions keep native ownership valid", () => {
    const borrowed = Regress.testCairoPatternNoneReturn();
    const owned = Regress.testCairoPatternFullReturn();
    expect(borrowed.getRgba()).toEqual({ red: 0.1, green: 0.2, blue: 0.3, alpha: 1 });
    expect(owned.getRgba()).toEqual({ red: 0.5, green: 0.6, blue: 0.7, alpha: 1 });
    Regress.testCairoPatternNoneIn(borrowed);
    Regress.testCairoPatternFullIn(owned);
    expect(owned.status()).toBe(Cairo.Status.SUCCESS);
    const region = Cairo.Region.empty();
    Regress.testCairoRegionFullIn(region);
    expect(region.isEmpty()).toBe(true);
});

test("foreign Cairo matrices and font outputs expose their native values", () => {
    const matrix = Regress.testCairoMatrixNoneReturn();
    expect(matrix.transformPoint(2, 3)).toEqual({ x: 2, y: 3 });
    Regress.testCairoMatrixNoneIn(matrix);
    const borrowed = Regress.testCairoFontOptionsNoneReturn();
    const owned = Regress.testCairoFontOptionsFullReturn();
    expect(owned.equal(borrowed)).toBe(true);
    Regress.testCairoFontOptionsNoneIn(borrowed);
    Regress.testCairoFontOptionsFullIn(owned);
    expect(owned.status()).toBe(Cairo.Status.SUCCESS);
    const context = Regress.testCairoContextFullReturn();
    const createFontFace = t.bind(
        "libcairo.so.2",
        "cairo_user_font_face_create",
        [],
        t.boxed("CairoFontFace", {
            ownership: "full",
            sharedLibrary: "libcairo-gobject.so.2",
            getTypeFnName: "cairo_gobject_font_face_get_type",
        }),
    );
    context.setFontFace(wrapHandle(createFontFace() as ExternalObject<Handle>, Cairo.FontFace));
    expect(Regress.testCairoFontFaceFullReturn(context).status()).toBe(Cairo.Status.SUCCESS);
    expect(Regress.testCairoScaledFontFullReturn(context).status()).toBe(Cairo.Status.SUCCESS);
});

test("native signals carry foreign records and return complete 64-bit values", () => {
    const object = new Regress.TestObj({});
    const contexts: Cairo.Context[] = [];
    object.connect("sig-with-foreign-struct", (context) => {
        Regress.testCairoContextNoneIn(context);
        expect(context.status()).toBe(Cairo.Status.SUCCESS);
        contexts.push(context);
    });
    object.emitSigWithForeignStruct();
    expect(contexts).toHaveLength(1);
    for (const context of contexts) {
        expect(() => context.status()).toThrow("only until that callback returns");
    }
    const values: bigint[] = [];
    object.connect("sig-with-int64-prop", (value) => {
        values.push(value);
        return value;
    });
    object.connect("sig-with-uint64-prop", (value) => {
        values.push(value);
        return value;
    });
    object.emitSigWithInt64();
    object.emitSigWithUint64();
    expect(values).toEqual([2n ** 63n - 1n, 2n ** 64n - 1n]);
});

test("annotation signals interpret pointer arguments using their declared element types", () => {
    const object = new Regress.AnnotationObject({});
    const strings: string[] = [];
    const lists: string[][] = [];
    object.connect("string-signal", (value) => strings.push(value));
    object.connect("list-signal", (value) => lists.push(value));
    object.emit("string-signal", "café");
    object.emit("list-signal", ["one", "two"]);
    object.emit("list-signal", []);
    expect(strings).toEqual(["café"]);
    expect(lists).toEqual([["one", "two"], []]);
});

test("boxed array and hash signal arguments preserve their values", () => {
    const object = new Regress.TestObj({});
    const arrays: number[][] = [];
    const maps: Map<string, string | null>[] = [];
    object.connect("sig-with-array-prop", (values) => arrays.push(values));
    object.connect("sig-with-hash-prop", (values) => {
        maps.push(new Map([...values].map(([key, value]) => [key, value.getString()])));
    });
    object.emit("sig-with-array-prop", [0, 42, 2 ** 32 - 1]);
    const value = new GObject.Value();
    value.init(GObject.TYPE_STRING);
    value.setString("native");
    object.emit("sig-with-hash-prop", new Map([["text", value]]));
    expect(arrays).toEqual([[0, 42, 2 ** 32 - 1]]);
    expect(maps).toEqual([new Map([["text", "native"]])]);
});

test("an integer array signal result returns each element to its emitter", () => {
    const object = new Regress.TestObj({});
    object.connect("sig-with-intarray-ret", (value) => [value, value + 1, value + 2]);
    expect(object.emit("sig-with-intarray-ret", 42)).toEqual([42, 43, 44]);
});

test("native action handlers return a floating object and a nullable result", async () => {
    const action = new Regress.TestAction({});
    const returned = action.emit("action");
    expect(returned).toBeInstanceOf(Regress.TestAction);
    await drainGC();
    expect(returned.emit("action2")).toBeNull();
    expect(action.emit("action2")).toBeNull();
});
