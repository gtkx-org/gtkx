import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";

import * as Gio from "@gtkx/gi/gio";

import * as GLib from "@gtkx/gi/glib";

import * as GObject from "@gtkx/gi/gobject";

import * as Regress from "@gtkx/gi/regress";

import { callParent, getClassType, getInstanceType, registerClass, typeIsA } from "@gtkx/runtime";

import { expect, test } from "vitest";

import { drainGC } from "./helpers/memory.js";

type Holder<T> = { value: T | null };

const createTypeNameFactory = (): ((prefix: string) => string) => {
    let index = 0;

    return (prefix) => {
        index += 1;

        return `${prefix}Vfunc${String(process.pid)}_${String(index)}`;
    };
};

const uniqueName = createTypeNameFactory();

const held = <T>(holder: Holder<T>): T => {
    if (holder.value === null) {
        throw new Error("the vfunc was never handed a value");
    }

    return holder.value;
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
        override vfuncVfuncWithCallback(callback: GIMarshallingTests.CallbackIntInt): void {
            seen.push(typeof callback, callback(5), callback(-3));
        }
    }

    const Registered = registerClass(WithCallback, { typeName: uniqueName("GtkxWithCallback") });
    const instance = new Registered({});
    instance.callVfuncWithCallback();
    expect(seen).toEqual(["function", 5, -3]);
});

test("a call-scoped callback retained after the vfunc returns expires", () => {
    const captured: Holder<GIMarshallingTests.CallbackIntInt> = { value: null };

    class WithRetainedCallback extends GIMarshallingTests.Object {
        override vfuncVfuncWithCallback(callback: GIMarshallingTests.CallbackIntInt): void {
            captured.value = callback;
            expect(callback(7)).toBe(7);
        }
    }

    const Registered = registerClass(WithRetainedCallback, { typeName: uniqueName("GtkxRetainedCallback") });
    new Registered({}).callVfuncWithCallback();
    expect(() => held(captured)(8)).toThrow();
});

test("a call-scoped callback expires before its first delayed invocation", () => {
    const captured: Holder<GIMarshallingTests.CallbackIntInt> = { value: null };

    class WithDelayedCallback extends GIMarshallingTests.Object {
        override vfuncVfuncWithCallback(callback: GIMarshallingTests.CallbackIntInt): void {
            captured.value = callback;
        }
    }

    const Registered = registerClass(WithDelayedCallback, { typeName: uniqueName("GtkxDelayedCallback") });
    new Registered({}).callVfuncWithCallback();
    expect(() => held(captured)(9)).toThrow();
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
    const seen: number[][] = [];

    class Collector extends GObject.Object implements GIMarshallingTests.Interface3Impl {
        declare testVariantArrayIn: GIMarshallingTests.Interface3["testVariantArrayIn"];

        vfuncTestVariantArrayIn(values: GLib.Variant[]): void {
            seen.push(values.map((variant) => variant.getInt32()));
        }
    }

    const Registered = registerClass(Collector, {
        typeName: uniqueName("GtkxCollector"),
        implements: [GIMarshallingTests.Interface3],
    });

    const instance = new Registered({});
    instance.testVariantArrayIn([GLib.Variant.newInt32(1), GLib.Variant.newInt32(2)]);
    expect(seen).toEqual([[1, 2]]);

    instance.testVariantArrayIn([]);
    expect(seen[1]).toEqual([]);
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
