import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import * as WarnLib from "@gtkx/gi/warnlib";
import { callParent, getClassType, getInstanceType, registerClass, typeIsA } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainAfterEachTest, drainGC } from "./helpers/memory.js";

type Holder<T> = { value: T | null };
type ReadyCallbacks = (Gio.AsyncReadyCallback | null)[];

drainAfterEachTest();

const createTypeNameFactory = (): ((prefix: string) => string) => {
    let index = 0;

    return (prefix) => {
        index += 1;

        return `${prefix}Vfunc${String(process.pid)}_${String(index)}`;
    };
};

const uniqueName = createTypeNameFactory();

const READWRITE = GObject.ParamFlags.READWRITE;
const DATA_CHANGED = "data_changed";

const BAG_PROPERTIES = {
    plain: GObject.paramSpecInt("plain", null, null, 0, 100, 5, READWRITE),
    doubled: GObject.paramSpecInt("doubled", null, null, 0, 100, 0, READWRITE),
    label: GObject.paramSpecString("label", null, null, "hi", READWRITE),
};

const PINGER_SIGNALS = {
    pinged: {
        flags: GObject.SignalFlags.RUN_LAST,
        paramTypes: [GObject.TYPE_STRING],
        returnType: GObject.TYPE_INT,
    },
    quiet: {},
    [DATA_CHANGED]: { paramTypes: [GObject.TYPE_INT] },
};

const held = <T>(holder: Holder<T>): T => {
    if (holder.value === null) {
        throw new Error("the vfunc was never handed a value");
    }

    return holder.value;
};

const firstCallback = (captured: ReadyCallbacks): Gio.AsyncReadyCallback => {
    const [callback] = captured;

    if (callback === null || callback === undefined) {
        throw new Error("the vfunc captured no callback");
    }

    return callback;
};

const registerDeferredInitable = (typeName: string, captured: ReadyCallbacks) => {
    class DeferredInit extends GObject.Object implements Gio.AsyncInitableImpl {
        declare initAsync: Gio.AsyncInitable["initAsync"];

        vfuncInitAsync(
            _ioPriority: number,
            _cancellable: Gio.Cancellable | null,
            callback: Gio.AsyncReadyCallback | null,
        ): void {
            captured.push(callback);
        }
    }

    return registerClass(DeferredInit, { typeName, implements: [Gio.AsyncInitable] });
};

test("a registered subclass fills the int8 vtable slots the C callers dispatch to", () => {
    const seen: number[] = [];

    class Int8Slots extends GIMarshallingTests.Object {
        override vfuncMethodInt8In(value: number): void {
            seen.push(value);
        }

        override vfuncMethodInt8Out(): number {
            return -5;
        }

        override vfuncMethodInt8ArgAndOutCaller(arg: number): number {
            return arg * 2;
        }

        override vfuncMethodInt8ArgAndOutCallee(arg: number): number {
            return arg + 1;
        }

        override vfuncMethodStrArgOutRet(arg: string): [string, number] {
            return [`${arg}!`, 9];
        }
    }

    const Registered = registerClass(Int8Slots, { typeName: uniqueName("GtkxInt8Slots") });
    const instance = new Registered({});
    expect(instance instanceof Int8Slots).toBeTruthy();
    expect(instance instanceof GIMarshallingTests.Object).toBeTruthy();
    expect(instance instanceof GObject.Object).toBeTruthy();

    instance.methodInt8In(42);
    instance.int8In(-7);
    expect(seen).toEqual([42, -7]);

    expect(instance.methodInt8Out()).toBe(-5);
    expect(instance.int8Out()).toBe(-5);
    expect(instance.methodInt8ArgAndOutCaller(3)).toBe(6);
    expect(instance.vfuncMethodInt8ArgAndOutCallee(41)).toBe(42);
    expect(instance.methodStrArgOutRet("hi")).toEqual(["hi!", 9]);
});

test("an override reaches the implementation it replaces through super", () => {
    const seen: number[] = [];

    class Chained extends GIMarshallingTests.Object {
        override vfuncMethodWithDefaultImplementation(value: number): void {
            seen.push(value);
            super.vfuncMethodWithDefaultImplementation(value + 1);
        }
    }

    const Registered = registerClass(Chained, { typeName: uniqueName("GtkxChained") });
    const instance = new Registered({});
    instance.methodWithDefaultImplementation(10);
    expect(seen).toEqual([10]);
    expect(instance.int).toBe(11);
});

test("an override reaches the parent implementation through callParent", () => {
    const seen: number[] = [];

    class Parented extends GIMarshallingTests.Object {
        override vfuncMethodWithDefaultImplementation(value: number): void {
            seen.push(value);
            callParent(Parented, "vfuncMethodWithDefaultImplementation", this, value + 2);
        }
    }

    const Registered = registerClass(Parented, { typeName: uniqueName("GtkxParented") });
    const instance = new Registered({});
    instance.methodWithDefaultImplementation(5);
    expect(seen).toEqual([5]);
    expect(instance.int).toBe(7);
});

test("a slot filled several types up the hierarchy is reached from a JavaScript override", () => {
    const seen: number[] = [];

    class DeepHierarchy extends GIMarshallingTests.SubSubObject {
        override vfuncMethodDeepHierarchy(value: number): void {
            seen.push(value);
            super.vfuncMethodDeepHierarchy(value + 1);
        }
    }

    const Registered = registerClass(DeepHierarchy, { typeName: uniqueName("GtkxDeepHierarchy") });
    const instance = new Registered({});
    expect(instance instanceof GIMarshallingTests.SubObject).toBeTruthy();
    instance.vfuncMethodDeepHierarchy(10);
    expect(seen).toEqual([10]);
    expect(instance.int).toBe(11);

    instance.methodWithDefaultImplementation(3);
    expect(instance.int).toBe(3);
});

test("vfunc slots with a return value and out parameters marshal them back to C", () => {
    class Returning extends GIMarshallingTests.Object {
        override vfuncVfuncReturnValueOnly(): bigint {
            return 42n;
        }

        override vfuncVfuncOneOutParameter(): number {
            return 0.5;
        }

        override vfuncVfuncMultipleOutParameters(): [number, number] {
            return [1.5, 2.5];
        }

        override vfuncVfuncArrayOutParameter(): number[] {
            return [1.5, 2.5, 3.5];
        }

        override vfuncVfuncReturnValueAndOneOutParameter(): [bigint, bigint] {
            return [42n, 43n];
        }

        override vfuncVfuncReturnValueAndMultipleOutParameters(): [bigint, bigint, bigint] {
            return [42n, 43n, 44n];
        }
    }

    const Registered = registerClass(Returning, { typeName: uniqueName("GtkxReturning") });
    const instance = new Registered({});

    expect(instance.vfuncReturnValueOnly()).toBe(42n);
    expect(instance.vfuncOneOutParameter()).toBe(0.5);
    expect(instance.vfuncMultipleOutParameters()).toEqual([1.5, 2.5]);
    expect(instance.vfuncArrayOutParameter()).toEqual([1.5, 2.5, 3.5]);
    expect(instance.vfuncReturnValueAndOneOutParameter()).toEqual([42n, 43n]);
    expect(instance.vfuncReturnValueAndMultipleOutParameters()).toEqual([42n, 43n, 44n]);
});

test("inout vfunc parameters arrive seeded and travel back to the C caller", () => {
    const seen: (bigint | number)[] = [];

    class Inout extends GIMarshallingTests.Object {
        override vfuncVfuncOneInoutParameter(a: number): number {
            seen.push(a);

            return a * 2;
        }

        override vfuncVfuncMultipleInoutParameters(a: number, b: number): [number, number] {
            seen.push(a, b);

            return [a * 2, b * 2];
        }

        override vfuncVfuncReturnValueAndOneInoutParameter(a: bigint): [bigint, bigint] {
            seen.push(a);

            return [42n, a * 2n];
        }

        override vfuncVfuncReturnValueAndMultipleInoutParameters(a: bigint, b: bigint): [bigint, bigint, bigint] {
            seen.push(a, b);

            return [42n, a * 2n, b * 2n];
        }
    }

    const Registered = registerClass(Inout, { typeName: uniqueName("GtkxInout") });
    const instance = new Registered({});

    expect(instance.vfuncOneInoutParameter(2.5)).toBe(5);
    expect(instance.vfuncMultipleInoutParameters(1.5, 2.5)).toEqual([3, 5]);
    expect(instance.vfuncReturnValueAndOneInoutParameter(3n)).toEqual([42n, 6n]);
    expect(instance.vfuncReturnValueAndMultipleInoutParameters(3n, 4n)).toEqual([42n, 6n, 8n]);
    expect(seen).toEqual([2.5, 1.5, 2.5, 3n, 3n, 4n]);
});

test("enum and flags vfunc slots marshal their members in both directions", () => {
    class Enums extends GIMarshallingTests.Object {
        override vfuncVfuncReturnEnum(): GIMarshallingTests.Enum {
            return GIMarshallingTests.Enum.VALUE3;
        }

        override vfuncVfuncOutEnum(): GIMarshallingTests.Enum {
            return GIMarshallingTests.Enum.VALUE2;
        }

        override vfuncVfuncReturnFlags(): GIMarshallingTests.Flags {
            return GIMarshallingTests.Flags.VALUE2;
        }

        override vfuncVfuncOutFlags(): GIMarshallingTests.Flags {
            return GIMarshallingTests.Flags.VALUE3;
        }
    }

    const Registered = registerClass(Enums, { typeName: uniqueName("GtkxEnums") });
    const instance = new Registered({});

    expect(instance.vfuncReturnEnum()).toBe(GIMarshallingTests.Enum.VALUE3);
    expect(instance.vfuncOutEnum()).toBe(GIMarshallingTests.Enum.VALUE2);
    expect(instance.vfuncReturnFlags()).toBe(GIMarshallingTests.Flags.VALUE2);
    expect(instance.vfuncOutFlags()).toBe(GIMarshallingTests.Flags.VALUE3);
});

test("a caller-allocated GValue out parameter is filled from the override", () => {
    const seen: boolean[] = [];

    class CallerAllocated extends GIMarshallingTests.Object {
        override vfuncVfuncCallerAllocatedOutParameter(a: GObject.Value): GObject.Value {
            seen.push(a instanceof GObject.Value);
            const value = new GObject.Value();
            value.init(GObject.typeFromName("gint"));
            value.setInt(42);

            return value;
        }
    }

    const Registered = registerClass(CallerAllocated, { typeName: uniqueName("GtkxCallerAllocated") });
    const instance = new Registered({});

    expect(instance.vfuncCallerAllocatedOutParameter()).toBe(42);
    expect(seen).toEqual([true]);
});

test("a call-scoped callback handed to a vfunc runs from JavaScript", () => {
    const seen: (number | string)[] = [];

    class WithCallback extends GIMarshallingTests.Object {
        vfuncVfuncWithCallback(callback: GIMarshallingTests.CallbackIntInt): void {
            seen.push(typeof callback, callback(5), callback(-3));
        }
    }

    const Registered = registerClass(WithCallback, { typeName: uniqueName("GtkxWithCallback") });
    const instance = new Registered({});
    instance.callVfuncWithCallback();
    expect(seen).toEqual(["function", 5, -3]);
});

test("a vfunc that reports success returns its value to the C caller", () => {
    const seen: number[] = [];

    class Fallible extends GIMarshallingTests.Object {
        override vfuncVfuncMethWithErr(x: number): boolean {
            seen.push(x);

            if (x === 0) {
                throw new Error("refused");
            }

            return true;
        }
    }

    const Registered = registerClass(Fallible, { typeName: uniqueName("GtkxFallible") });
    const instance = new Registered({});
    expect(instance.vfuncMethWithError(1)).toBe(true);
    expect(seen).toEqual([1]);
});

test("a vfunc that throws surfaces as an error from the C caller", () => {
    class Throwing extends GIMarshallingTests.Object {
        override vfuncVfuncMethWithErr(): boolean {
            throw new Error("refused");
        }
    }

    const Registered = registerClass(Throwing, { typeName: uniqueName("GtkxThrowing") });
    expect(() => new Registered({}).vfuncMethWithError(0)).toThrow();
});

test("a GError rethrown from a vfunc surfaces as an error from the C caller", () => {
    class Rethrowing extends GIMarshallingTests.Object {
        override vfuncVfuncMethWithErr(): boolean {
            throw GIMarshallingTests.gerrorReturn();
        }
    }

    const Registered = registerClass(Rethrowing, { typeName: uniqueName("GtkxRethrowing") });
    expect(() => new Registered({}).vfuncMethWithError(0)).toThrow();
});

test("object returning vfuncs report the ref counts their transfer annotations imply", async () => {
    const holder: Holder<GIMarshallingTests.Object> = { value: null };

    class Returning extends GIMarshallingTests.Object {
        override vfuncVfuncReturnObjectTransferNone(): GObject.Object {
            return held(holder);
        }

        override vfuncVfuncOutObjectTransferNone(): GObject.Object {
            return held(holder);
        }

        override vfuncVfuncReturnObjectTransferFull(): GObject.Object {
            return new GIMarshallingTests.Object({ int: 4 });
        }

        override vfuncVfuncOutObjectTransferFull(): GObject.Object {
            return new GIMarshallingTests.Object({ int: 5 });
        }
    }

    const Registered = registerClass(Returning, { typeName: uniqueName("GtkxObjectReturning") });
    const instance = new Registered({});
    holder.value = new GIMarshallingTests.Object({ int: 3 });

    expect(instance.getRefInfoForVfuncReturnObjectTransferNone()).toEqual([1, false]);
    expect(instance.getRefInfoForVfuncOutObjectTransferNone()).toEqual([1, false]);
    expect(instance.getRefInfoForVfuncReturnObjectTransferFull()).toEqual([2, false]);
    expect(instance.getRefInfoForVfuncOutObjectTransferFull()).toEqual([2, false]);
    expect(held(holder).int).toBe(3);
    holder.value = null;
    await drainGC();
});

test("objects passed into a vfunc arrive as wrappers of their registered class", () => {
    const seen: [string, boolean, boolean, number][] = [];

    class Claiming extends GIMarshallingTests.Object {
        override vfuncVfuncInObjectTransferNone(object: GIMarshallingTests.Object): void {
            seen.push(["none", object instanceof Claiming, object === this, object.int]);
        }

        override vfuncVfuncInObjectTransferFull(object: GIMarshallingTests.Object): void {
            seen.push(["full", object instanceof Claiming, object === this, object.int]);
        }
    }

    const Registered = registerClass(Claiming, { typeName: uniqueName("GtkxClaiming") });
    const instance = new Registered({});

    expect(instance.getRefInfoForVfuncInObjectTransferNone(Registered)).toEqual([2, false]);
    expect(instance.getRefInfoForVfuncInObjectTransferFull(Registered)).toEqual([1, false]);
    expect(seen).toEqual([
        ["none", true, false, 0],
        ["full", true, false, 0],
    ]);

    expect(instance.getRefInfoForVfuncInObjectTransferNone(GIMarshallingTests.Object)).toEqual([2, false]);
    expect(seen).toHaveLength(3);
    expect(seen[2]).toEqual(["none", false, false, 0]);
});

test("a static vtable slot is filled without an instance", () => {
    const anchor = new GIMarshallingTests.Object({});
    expect(GIMarshallingTests.Object.vfuncStaticName()).toBe("GIMarshallingTestsObject");
    expect(anchor.int).toBe(0);

    class StaticName extends GIMarshallingTests.Object {
        override vfuncVfuncStaticName(): string {
            return "from-javascript";
        }
    }

    const Registered = registerClass(StaticName, { typeName: uniqueName("GtkxStaticName") });
    const instance = new Registered({});
    expect(instance instanceof StaticName).toBeTruthy();
    expect(GIMarshallingTests.Object.vfuncStaticTypedName(Registered)).toBe("from-javascript");
    expect(GIMarshallingTests.Object.vfuncStaticTypedName(GIMarshallingTests.Object)).toBe("GIMarshallingTestsObject");
});

test("an interface filled by a registered class is dispatched from C", async () => {
    const seen: [number, boolean][] = [];
    const holder: Holder<GObject.Object> = { value: null };

    class Speaker extends GObject.Object implements GIMarshallingTests.InterfaceImplImpl {
        declare testInt8In: GIMarshallingTests.Interface["testInt8In"];

        vfuncTestInt8In(value: number): void {
            seen.push([value, this === holder.value]);
        }
    }

    const Registered = registerClass(Speaker, {
        typeName: uniqueName("GtkxSpeaker"),
        implements: [GIMarshallingTests.Interface],
    });

    const instance = new Registered({});
    holder.value = instance;
    expect(instance instanceof GIMarshallingTests.Interface).toBeTruthy();
    expect(typeIsA(getInstanceType(instance), getClassType(GIMarshallingTests.Interface))).toBeTruthy();

    GIMarshallingTests.testInterfaceTestInt8In(instance, 42);
    instance.testInt8In(-7);
    expect(seen).toEqual([
        [42, true],
        [-7, true],
    ]);
    holder.value = null;
    await drainGC();
});

test("a second interface with the same slot name is adopted alongside the first", () => {
    const seen: number[] = [];

    class Pair extends GObject.Object implements GIMarshallingTests.Interface2Impl {
        declare testInt8In: GIMarshallingTests.Interface["testInt8In"];

        vfuncTestInt8In(value: number): void {
            seen.push(value);
        }
    }

    const Registered = registerClass(Pair, {
        typeName: uniqueName("GtkxPair"),
        implements: [GIMarshallingTests.Interface, GIMarshallingTests.Interface2],
    });

    const instance = new Registered({});
    expect(instance instanceof GIMarshallingTests.Interface).toBeTruthy();
    expect(instance instanceof GIMarshallingTests.Interface2).toBeTruthy();
    expect(typeIsA(getInstanceType(instance), getClassType(GIMarshallingTests.Interface2))).toBeTruthy();

    GIMarshallingTests.testInterfaceTestInt8In(instance, 11);
    expect(seen).toEqual([11]);
});

test("an interface slot taking a variant array is dispatched from C", () => {
    const seen: [number[], number][] = [];

    class Collector extends GObject.Object implements GIMarshallingTests.Interface3Impl {
        declare testVariantArrayIn: GIMarshallingTests.Interface3["testVariantArrayIn"];

        vfuncTestVariantArrayIn(values: GLib.Variant[], count: number): void {
            seen.push([values.map((variant) => variant.getInt32()), count]);
        }
    }

    const Registered = registerClass(Collector, {
        typeName: uniqueName("GtkxCollector"),
        implements: [GIMarshallingTests.Interface3],
    });

    const instance = new Registered({});
    instance.testVariantArrayIn([GLib.Variant.newInt32(1), GLib.Variant.newInt32(2)]);
    expect(seen).toEqual([[[1, 2], 2]]);

    instance.testVariantArrayIn([]);
    expect(seen[1]).toEqual([[], 0]);
});

test("a class adopting no slot keeps the interface default implementation", () => {
    class Silent extends GObject.Object {}

    const Registered = registerClass(Silent, {
        typeName: uniqueName("GtkxSilent"),
        implements: [GIMarshallingTests.Interface2],
    });

    const instance = new Registered({});
    expect(instance instanceof GIMarshallingTests.Interface2).toBeTruthy();
    expect(typeIsA(getInstanceType(instance), getClassType(GIMarshallingTests.Interface))).toBe(false);
});

test("the C interface implementation dispatches through the same interface surface", () => {
    const impl = new GIMarshallingTests.InterfaceImpl({});
    expect(impl instanceof GIMarshallingTests.Interface).toBeTruthy();
    expect(impl.getAsInterface()).toBe(impl);
    impl.testInt8In(42);
    GIMarshallingTests.testInterfaceTestInt8In(impl, 42);
    expect(impl.getAsInterface()).toBe(impl.getAsInterface());
});

test("registerClass installs declared properties with generated and custom accessors", () => {
    class Bag extends GObject.Object {
        declare doubledStorage: number | undefined;
        declare label: string;
        declare plain: number;

        get doubled(): number {
            return this.doubledStorage ?? 0;
        }

        set doubled(value: number) {
            this.doubledStorage = value * 2;
        }
    }

    const Registered = registerClass(Bag, { typeName: uniqueName("GtkxBag"), properties: BAG_PROPERTIES });
    const instance = new Registered({});
    expect(instance.plain).toBe(5);
    expect(instance.label).toBe("hi");
    expect(instance.doubled).toBe(0);

    GObject.setObjectProperty(instance, "plain", 9);
    GObject.setObjectProperty(instance, "label", "there");
    GObject.setObjectProperty(instance, "doubled", 4);
    expect(GObject.getObjectProperty(instance, "plain")).toBe(9);
    expect(GObject.getObjectProperty(instance, "label")).toBe("there");
    expect(GObject.getObjectProperty(instance, "doubled")).toBe(8);

    const constructed = new Registered({ plain: 11, label: "bye", doubled: 3 });
    expect(constructed.plain).toBe(11);
    expect(constructed.label).toBe("bye");
    expect(constructed.doubled).toBe(6);

    const value = new GObject.Value();
    value.init(GObject.typeFromName("gint"));
    instance.getProperty("doubled", value);
    expect(value.getInt()).toBe(8);
    instance.getProperty("plain", value);
    expect(value.getInt()).toBe(9);

    const notified: string[] = [];
    const id = instance.connect("notify::plain", (pspec) => {
        notified.push(pspec.getName());
    });
    instance.plain = 12;
    expect(instance.plain).toBe(12);
    instance.plain = 12;
    expect(instance.plain).toBe(12);
    expect(notified).toEqual(["plain"]);
    GObject.signalHandlerDisconnect(instance, BigInt(id));
});

test("a registered property hidden by an own method keeps separate storage", () => {
    class Ranked extends GObject.Object {
        score(): string {
            return "own method";
        }
    }

    const Registered = registerClass(Ranked, {
        typeName: uniqueName("GtkxOwnMethodProperty"),
        properties: { score: GObject.paramSpecInt("score", null, null, 0, 100, 7, READWRITE) },
    });

    const instance = new Registered({});
    expect(instance.score()).toBe("own method");
    expect(Reflect.apply(GObject.getObjectProperty, undefined, [instance, "score"])).toBe(7);
    Reflect.apply(GObject.setObjectProperty, undefined, [instance, "score", 9]);
    expect(Reflect.apply(GObject.getObjectProperty, undefined, [instance, "score"])).toBe(9);
    expect(instance.score()).toBe("own method");
});

test("a registered property hidden by an inherited method keeps separate storage", () => {
    class RankedBase extends GObject.Object {
        score(): string {
            return "inherited method";
        }
    }

    class Ranked extends RankedBase {
        rank = (): string => "field method";
    }

    const Registered = registerClass(Ranked, {
        typeName: uniqueName("GtkxInheritedMethodProperty"),
        properties: {
            rank: GObject.paramSpecInt("rank", null, null, 0, 100, 5, READWRITE),
            score: GObject.paramSpecInt("score", null, null, 0, 100, 7, READWRITE),
        },
    });

    const instance = new Registered({});
    expect(instance.rank()).toBe("field method");
    expect(Reflect.apply(GObject.getObjectProperty, undefined, [instance, "rank"])).toBe(5);
    Reflect.apply(GObject.setObjectProperty, undefined, [instance, "rank", 6]);
    expect(Reflect.apply(GObject.getObjectProperty, undefined, [instance, "rank"])).toBe(6);
    expect(instance.rank()).toBe("field method");
    expect(instance.score()).toBe("inherited method");
    expect(Reflect.apply(GObject.getObjectProperty, undefined, [instance, "score"])).toBe(7);
    Reflect.apply(GObject.setObjectProperty, undefined, [instance, "score", 9]);
    expect(Reflect.apply(GObject.getObjectProperty, undefined, [instance, "score"])).toBe(9);
    expect(instance.score()).toBe("inherited method");
});

test("a registered property hidden by a method rejects an invalid value", () => {
    class Ranked extends GObject.Object {
        score(): string {
            return "method";
        }
    }

    const Registered = registerClass(Ranked, {
        typeName: uniqueName("GtkxInvalidMethodProperty"),
        properties: { score: GObject.paramSpecInt("score", null, null, 0, 100, 7, READWRITE) },
    });

    const instance = new Registered({});
    expect(() => {
        Reflect.apply(GObject.setObjectProperty, undefined, [instance, "score", "invalid"]);
    }).toThrow();
});

test("registerClass creates declared signals that connect emit and run their default handler", () => {
    const defaults: string[] = [];

    class Pinger extends GObject.Object {
        onPinged(text: string): number {
            defaults.push(text);

            return text.length;
        }
    }

    const Registered = registerClass(Pinger, { typeName: uniqueName("GtkxPinger"), signals: PINGER_SIGNALS });
    const instance = new Registered({});
    const handled: string[] = [];
    GObject.signalConnect(instance, "pinged", (text) => {
        if (typeof text === "string") {
            handled.push(text);
        }

        return 99;
    });

    expect(GObject.signalEmit(instance, "pinged", "abc")).toBe(3);
    expect(handled).toEqual(["abc"]);
    expect(defaults).toEqual(["abc"]);

    expect(instance.emit("quiet")).toBeUndefined();

    const dashed: number[] = [];
    GObject.signalConnect(instance, DATA_CHANGED, (count) => {
        if (typeof count === "number") {
            dashed.push(count);
        }
    });
    GObject.signalEmit(instance, DATA_CHANGED, 7);
    GObject.signalEmit(instance, "data-changed", 8);
    expect(dashed).toEqual([7, 8]);
});

test("class signals keep precedence over a newly adopted interface signal", () => {
    class Parent extends GObject.Object {}

    const RegisteredParent = registerClass(Parent, {
        typeName: uniqueName("GtkxSignalParent"),
        signals: { "items-changed": {} },
    });

    class Child extends RegisteredParent {}

    const RegisteredChild = registerClass(Child, {
        typeName: uniqueName("GtkxSignalChild"),
        implements: [Gio.ListModel],
    });
    const instance = new RegisteredChild({});
    const arities: number[] = [];
    GObject.signalConnect(instance, "items-changed", (...args) => {
        arities.push(args.length);
    });

    GObject.signalEmit(instance, "items-changed");
    expect(arities).toEqual([0]);
});

test("the later native interface owns a colliding signal shape", () => {
    class InterfacePayload extends Gio.DBusInterfaceSkeleton {}

    const RegisteredPayload = registerClass(InterfacePayload, {
        typeName: uniqueName("GtkxInterfacePayload"),
    });
    const payload = new RegisteredPayload({});
    const object = Gio.DBusObjectSkeleton.new("/com/gtkx/SignalOwner");

    class ObjectThenManager extends GObject.Object {}

    const RegisteredObjectThenManager = registerClass(ObjectThenManager, {
        typeName: uniqueName("GtkxObjectThenManager"),
        implements: [Gio.DBusObject, Gio.DBusObjectManager],
    });
    const managerLast = new RegisteredObjectThenManager({});
    const managerArgs: unknown[][] = [];
    GObject.signalConnect(managerLast, "interface-added", (...args) => {
        managerArgs.push(args);
    });
    GObject.signalEmit(managerLast, "interface-added", object, payload);

    class ManagerThenObject extends GObject.Object {}

    const RegisteredManagerThenObject = registerClass(ManagerThenObject, {
        typeName: uniqueName("GtkxManagerThenObject"),
        implements: [Gio.DBusObjectManager, Gio.DBusObject],
    });
    const objectLast = new RegisteredManagerThenObject({});
    const objectArgs: unknown[][] = [];
    GObject.signalConnect(objectLast, "interface-added", (...args) => {
        objectArgs.push(args);
    });
    GObject.signalEmit(objectLast, "interface-added", payload);

    expect(managerArgs).toEqual([[object, payload]]);
    expect(objectArgs).toEqual([[payload]]);
});

test("declared signals reject emissions their parameter types cannot hold", () => {
    class Strict extends GObject.Object {
        declare count: number;
    }

    const Registered = registerClass(Strict, {
        typeName: uniqueName("GtkxStrict"),
        signals: { tagged: { paramTypes: [GObject.TYPE_INT] } },
        properties: { count: GObject.paramSpecInt("count", null, null, 0, 10, 0, READWRITE) },
    });

    expect(new Registered({}).count).toBe(0);
    expect(() => new Registered({}).emit("tagged", "nope")).toThrow();
    expect(() => new Registered({}).emit("tagged")).toThrow();
    expect(() => new Registered({}).emit("tagged", 1, 2)).toThrow();
    const instance = new Registered({});
    expect(() => {
        Reflect.apply(instance.emit.bind(instance), instance, ["missing", 1]);
    }).toThrow();
    expect(() => {
        new Registered({}).count = 99;
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not the number the property holds
        new Registered({}).count = "nope";
    }).toThrow();
    expect(() => new Registered({ count: 99 })).toThrow();
});

test("an AsyncInitable registered from JavaScript resolves through its callback", async () => {
    const seen: [number, Gio.Cancellable | null, string][] = [];

    class EagerInit extends GObject.Object implements Gio.AsyncInitableImpl {
        declare initAsync: Gio.AsyncInitable["initAsync"];

        vfuncInitAsync(
            ioPriority: number,
            cancellable: Gio.Cancellable | null,
            callback: Gio.AsyncReadyCallback | null,
        ): void {
            seen.push([ioPriority, cancellable, typeof callback]);
            const task = Gio.Task.new(this, cancellable, null);
            task.returnBoolean(true);
            callback?.(this, task, null);
        }
    }

    const Registered = registerClass(EagerInit, {
        typeName: uniqueName("GtkxEagerInit"),
        implements: [Gio.AsyncInitable],
    });

    const instance = new Registered({});
    expect(instance instanceof Gio.AsyncInitable).toBeTruthy();
    expect(await instance.initAsync(7)).toBe(true);
    expect(seen).toEqual([[7, null, "function"]]);
    await drainGC();
});

test("an AsyncInitable callback captured by the vfunc completes the pending init later", async () => {
    const captured: ReadyCallbacks = [];
    const Registered = registerDeferredInitable(uniqueName("GtkxDeferredInit"), captured);
    const instance = new Registered({});
    const pending = instance.initAsync(0);
    expect(captured).toHaveLength(1);
    expect(typeof captured[0]).toBe("function");

    const task = Gio.Task.new(instance, null, null);
    task.returnBoolean(true);
    firstCallback(captured)(instance, task, null);
    expect(await pending).toBe(true);

    instance.vfuncInitAsync(0, null, null);
    expect(captured).toHaveLength(2);
    expect(captured[1]).toBeNull();
    captured.length = 0;
    await drainGC();
});

test("an AsyncInitable callback rejects arguments of the wrong type", async () => {
    const captured: ReadyCallbacks = [];
    const Registered = registerDeferredInitable(uniqueName("GtkxBadArgsInit"), captured);
    const instance = new Registered({});
    const pending = instance.initAsync(0);
    const callback = firstCallback(captured);
    const task = Gio.Task.new(instance, null, null);
    task.returnBoolean(true);

    expect(() => {
        // @ts-expect-error a string is not the source object the callback takes
        callback("garbage", task, null);
    }).toThrow();

    expect(() => {
        // @ts-expect-error a string is not the async result the callback takes
        callback(instance, "garbage", null);
    }).toThrow();

    callback(instance, task, null);
    expect(await pending).toBe(true);
    expect(() => {
        callback(instance, task, null);
    }).toThrow();
    captured.length = 0;
    await drainGC();
});

test("registerClass refuses classes it cannot derive a GType from", () => {
    class Bare {
        tag = "bare";
    }

    expect(() => registerClass(Bare, { typeName: uniqueName("GtkxBare") })).toThrow();
    // @ts-expect-error a plain object is not a class
    expect(() => registerClass({}, { typeName: uniqueName("GtkxPlain") })).toThrow();

    class Short extends GObject.Object {}

    expect(() => registerClass(Short, { typeName: "x" })).toThrow();

    class Punctuated extends GObject.Object {}

    expect(() => registerClass(Punctuated, { typeName: "Not A Name" })).toThrow();
});

test("registerClass refuses a duplicate type name", () => {
    const shared = uniqueName("GtkxDuplicate");

    class First extends GObject.Object {}
    class Second extends GObject.Object {}

    registerClass(First, { typeName: shared });
    expect(() => registerClass(Second, { typeName: shared })).toThrow();
});

test("registerClass refuses vfunc methods and interfaces it cannot place", () => {
    class Unknown extends GObject.Object {
        vfuncNotASlot(): number {
            return 0;
        }
    }

    expect(() => registerClass(Unknown, { typeName: uniqueName("GtkxUnknownSlot") })).toThrow();

    class NotAnInterface extends GObject.Object {}

    expect(() =>
        registerClass(NotAnInterface, {
            typeName: uniqueName("GtkxNotAnInterface"),
            // @ts-expect-error a class is not a registered interface
            implements: [GObject.Object],
        })).toThrow();

    class Uninitialized extends GObject.Object {}

    expect(() =>
        registerClass(Uninitialized, {
            typeName: uniqueName("GtkxUninitialized"),
            implements: [Gio.AsyncInitable],
        })).toThrow();

    class MismatchedProperty extends GObject.Object {}

    expect(() =>
        registerClass(MismatchedProperty, {
            typeName: uniqueName("GtkxMismatched"),
            properties: { alpha: GObject.paramSpecInt("beta", null, null, 0, 10, 0, READWRITE) },
        })).toThrow();

    class UppercaseSignal extends GObject.Object {}

    expect(() =>
        registerClass(UppercaseSignal, {
            typeName: uniqueName("GtkxUppercaseSignal"),
            signals: { myThing: {} },
        })).toThrow();

    class CssNamed extends GObject.Object {}

    expect(() =>
        registerClass(CssNamed, { typeName: uniqueName("GtkxCssNamed"), cssName: "thing" })).toThrow();
});

test("an abstract registered class cannot be constructed but still serves as a parent", () => {
    const seen: number[] = [];

    class AbstractBase extends GIMarshallingTests.Object {
        override vfuncMethodInt8In(value: number): void {
            seen.push(value);
        }
    }

    const Abstract = registerClass(AbstractBase, {
        typeName: uniqueName("GtkxAbstractBase"),
        abstract: true,
    });

    expect(() => new Abstract({})).toThrow();

    class Concrete extends AbstractBase {}

    const Registered = registerClass(Concrete, { typeName: uniqueName("GtkxConcrete") });
    const instance = new Registered({});
    instance.methodInt8In(21);
    expect(seen).toEqual([21]);
});

test("interfaces are not constructible with new", () => {
    const constructed: unknown[] = [];

    expect(() => {
        // @ts-expect-error an interface describes what a class implements, so it has no instances
        constructed.push(new Gio.ListModel());
    }).toThrow();

    expect(() => {
        // @ts-expect-error an interface describes what a class implements, so it has no instances
        constructed.push(new Regress.TestInterface());
    }).toThrow();

    expect(() => {
        // @ts-expect-error an interface describes what a class implements, so it has no instances
        constructed.push(new WarnLib.Whatever());
    }).toThrow();

    expect(constructed).toEqual([]);
});

test("interfaces still narrow implementers and dispatch their methods", () => {
    const store = Gio.ListStore.new(getClassType(GObject.Object));
    expect(store instanceof Gio.ListModel).toBeTruthy();
    expect(store.getNItems()).toBe(0);
    store.append(new GObject.Object({}));
    expect(store.getNItems()).toBe(1);

    const sub = Regress.TestSubObj.new();
    expect(sub instanceof Regress.TestInterface).toBeTruthy();
    expect(sub.instanceMethod()).toBe(0);
});
