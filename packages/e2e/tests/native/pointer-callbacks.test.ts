import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { registerClass } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainGC } from "./helpers/memory.js";

test("opaque pointers preserve exact addresses and null through generated calls", () => {
    for (const pointer of [null, 1n, 0x123456789abcn]) {
        expect(GIMarshallingTests.pointerInReturn(pointer)).toBe(pointer);
        expect(new Regress.AnnotationObject({}).withVoidp(pointer)).toBeUndefined();
        expect(new Regress.FooObject({}).various(pointer, GObject.Object)).toBeUndefined();
    }
    expect(() => GIMarshallingTests.pointerInReturn(-1n)).toThrow();
});

test("scalar pointer inputs and uninitialized scalar pointer outputs preserve their values", () => {
    const object = new Regress.AnnotationObject({});
    expect(object.in(-42)).toBe(-42);
    expect(object.in(2147483647)).toBe(2147483647);
    expect(object.useBuffer(255)).toBeUndefined();
    expect(GIMarshallingTests.enumOutUninitialized()).toEqual([false, null]);
    expect(GIMarshallingTests.noTypeFlagsOutUninitialized()).toEqual([false, null]);
});

test("opaque C buffers honor their annotated fixed scalar array shape", () => {
    const attributes = Array.from({ length: 32 }, (_, index) => index);
    expect(Regress.hasParameterNamedAttrs(42, attributes)).toBeUndefined();
    expect(() => Regress.hasParameterNamedAttrs(42, attributes.slice(1))).toThrow();
    expect(() => Regress.hasParameterNamedAttrs(42, attributes.with(0, -1))).toThrow();
});

test("callee-allocated scalar outputs dispatch a generated virtual method", () => {
    class BaseAccess extends GIMarshallingTests.Object {
        static invokeBase(instance: GIMarshallingTests.Object, value: number): number {
            return BaseAccess.prototype.vfuncMethodInt8ArgAndOutCallee.call(instance, value);
        }
    }
    class Implementation extends GIMarshallingTests.Object {
        override vfuncMethodInt8ArgAndOutCallee(value: number): number {
            return value * 2;
        }
    }
    const Registered = registerClass(Implementation, { typeName: "GtkxScalarPointerCalleeCoverage" });
    expect(new Registered({}).methodInt8ArgAndOutCallee(-37)).toBe(-74);
    expect(() => BaseAccess.invokeBase(new GIMarshallingTests.Object({}), 37)).toThrow("provides no implementation");
});

test("callback data can precede its callback and custom destroy arguments retain their order", () => {
    const values: number[][] = [];
    GIMarshallingTests.callbackUserDataBeforeCallback(17, -23, (a, b) => values.push([a, b]));
    expect(values).toEqual([[17, -23]]);
    Regress.annotationCustomDestroy((value) => value + 1);
    expect(Regress.annotationCustomDestroyCleanup()).toBeUndefined();
});

test("type-erased interface callbacks reach their registered implementation", () => {
    const calls: string[] = [];
    class Implementation extends Regress.FooObject implements Regress.FooSubInterfaceImpl {
        declare doBaz: Regress.FooSubInterface["doBaz"];
        vfuncDoBaz(callback: GObject.Callback): void {
            calls.push("method");
            callback();
        }
    }
    const Registered = registerClass(Implementation, {
        typeName: "GtkxTypeErasedCallbackCoverage",
        implements: [Regress.FooSubInterface],
    });
    new Registered({}).doBaz(() => calls.push("callback"));
    expect(calls).toEqual(["method", "callback"]);
});

test("callback-valued properties accept construction, replacement, and clearing", () => {
    const object = new Regress.AnnotationObject({ functionProperty: (value) => value + 1 });
    expect(object.functionProperty).toBeNull();
    object.functionProperty = (value) => value + 2;
    expect(object.functionProperty).toBeNull();
    object.functionProperty = null;
    expect(object.functionProperty).toBeNull();
    expect(new Regress.AnnotationObject({ functionProperty: (value) => value }).functionProperty).toBeNull();
});

test("pointer-valued signals deliver both nonnull addresses and null", () => {
    const annotation = new Regress.AnnotationObject({});
    const pointers: (bigint | null)[] = [];
    annotation.connect("doc-empty-arg-parsing", (pointer) => pointers.push(pointer));
    annotation.emit("doc-empty-arg-parsing", 0x123456789abcn);
    annotation.emit("doc-empty-arg-parsing", null);
    expect(pointers).toEqual([0x123456789abcn, null]);
    const object = new Regress.FooObject({});
    object.connect("signal", (input, pointer) => {
        expect(input).toBe(annotation);
        expect(pointer).toBe(0x123456789abcn);
        return "received";
    });
    expect(object.emit("signal", annotation, 0x123456789abcn)).toBe("received");
});

test("interface signals preserve integers encoded in pointer words", () => {
    class Implementation extends GObject.Object {}
    const Registered = registerClass(Implementation, {
        typeName: "GtkxPointerWordSignalCoverage",
        implements: [Regress.TestInterface],
    });
    const object = new Registered({});
    const values: number[] = [];
    object.connect("interface-signal", (value) => values.push(value));
    object.emitSignal();
    object.emit("interface-signal", -37);
    object.emit("interface-signal", 2147483647);
    expect(values).toEqual([0, -37, 2147483647]);
});

test("callback properties do not retain objects captured by their own callback", async () => {
    const reference = (() => {
        const object = new Regress.AnnotationObject({});
        object.functionProperty = (value) => object.stringProperty?.length ?? value;
        return new WeakRef(object);
    })();
    await drainGC();
    expect(reference.deref()).toBeUndefined();
});
