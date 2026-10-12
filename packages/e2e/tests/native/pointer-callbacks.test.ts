import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { setObjectProperty } from "@gtkx/native";
import {
    getClassType,
    getHandle,
    newObjectWithProperties,
    offSignal,
    onSignal,
    registerClass,
    registerConstructProperties,
    registerWrapperClass,
    t,
} from "@gtkx/runtime";
import { getProperty, getVfuncRegistry, setProperty, toValue } from "@gtkx/runtime/internal";
import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { didSettle, drainGC } from "./helpers/memory.js";

const directory = mkdtempSync(join(tmpdir(), "gtkx-pointer-callbacks-"));
const library = join(directory, "libgtkx-pointer-callbacks.so");
const compileFlags = execFileSync(resolveExecutable("pkg-config"), ["--cflags", "--libs", "gobject-2.0"], {
    encoding: "utf8",
})
    .trim()
    .split(/\s+/);
execFileSync(resolveExecutable("gcc"), [
    "-shared",
    "-fPIC",
    "-fsanitize=address",
    "-Wall",
    "-Wextra",
    "-Werror",
    join(import.meta.dirname, "fixtures/pointer-callbacks.c"),
    "-o",
    library,
    ...compileFlags,
]);
afterAll(() => rmSync(directory, { recursive: true, force: true }));

type StoredCallback = (value: number) => number;
const callbackDescriptor = t.callback([t.int32], t.int32, { scope: "call" });
const callbackObjectType = t.bind(library, "gtkx_callback_object_get_type", [], t.biguint64)() as bigint;
const getId = t.bind(library, "gtkx_callback_object_id", [t.object()], t.uint32);
const wasFinalized = t.bind(library, "gtkx_callback_object_was_finalized", [t.uint32], t.boolean);
const invoke = t.bind(library, "gtkx_callback_object_invoke", [t.object(), t.int32], t.int32);
const invokeWriteOnly = t.bind(library, "gtkx_callback_object_invoke_write_only", [t.object(), t.int32], t.int32);
const invokeDuringNextGet = t.bind(library, "gtkx_callback_object_invoke_during_next_get", [t.object()], t.void);
const invokeOnEveryGet = t.bind(library, "gtkx_callback_object_invoke_on_every_get", [t.object()], t.void);
const failNextGet = t.bind(library, "gtkx_callback_object_fail_next_get", [t.object()], t.void);
const invokeBeforeNextSet = t.bind(library, "gtkx_callback_object_invoke_before_next_set", [t.object()], t.void);
const failNextSet = t.bind(library, "gtkx_callback_object_fail_next_set", [t.object(), t.boolean], t.void);
const hold = t.bind(library, "gtkx_callback_object_hold", [t.object()], t.void);
const release = t.bind(library, "gtkx_callback_object_release", [], t.void);
const invokeHeld = t.bind(library, "gtkx_callback_object_invoke_held", [t.int32], t.int32);

class CallbackObject {
    constructor(props: { callback?: StoredCallback | null } = {}) {
        return newObjectWithProperties(getClassType(new.target), props, this);
    }

    get id(): number {
        return getId(getHandle(this)) as number;
    }

    get callback(): StoredCallback | null {
        return getProperty(this, "callback", callbackDescriptor) as StoredCallback | null;
    }

    set callback(callback: StoredCallback | null) {
        setProperty(this, "callback", callbackDescriptor, callback);
    }

    set writeOnlyCallback(callback: StoredCallback | null) {
        setProperty(this, "write-only-callback", callbackDescriptor, callback);
    }

    invoke(value: number): number {
        return invoke(getHandle(this), value) as number;
    }
}

registerWrapperClass(CallbackObject, callbackObjectType, getVfuncRegistry(GObject.Object));
registerConstructProperties(CallbackObject, { callback: ["callback", callbackDescriptor] });

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

test("constructed callback properties remain callable through native storage after collection", async () => {
    const { object, reference } = (() => {
        const callback = (value: number): number => value + 17;
        return { object: new CallbackObject({ callback }), reference: new WeakRef(callback) };
    })();

    await drainGC();
    expect(object.invoke(25)).toBe(42);
    expect(object.callback?.(25)).toBe(42);
    expect(reference.deref()).toBeDefined();
});

test("replacing and clearing callback properties releases their previous JavaScript callbacks", async () => {
    const object = new CallbackObject();
    const first = (() => {
        const callback = (value: number): number => value + 1;
        object.callback = callback;
        return new WeakRef(callback);
    })();
    await drainGC();
    expect(object.invoke(40)).toBe(41);
    const second = (() => {
        const callback = (value: number): number => value + 2;
        object.callback = callback;
        return new WeakRef(callback);
    })();

    expect(await didSettle(() => first.deref() === undefined)).toBe(true);
    expect(object.invoke(40)).toBe(42);
    expect(second.deref()).toBeDefined();
    object.callback = null;
    expect(await didSettle(() => second.deref() === undefined)).toBe(true);
    expect(object.callback).toBeNull();
    expect(object.invoke(40)).toBe(-1);
});

test("rejecting a mismatched native property value preserves its previous callback", async () => {
    const { object, reference } = (() => {
        const callback = (value: number): number => value + 30;
        return { object: new CallbackObject({ callback }), reference: new WeakRef(callback) };
    })();

    await drainGC();
    expect(() => setObjectProperty(getHandle(object), "callback", toValue(t.int32, 42))).toThrow();
    await drainGC();
    expect(object.invoke(12)).toBe(42);
    expect(object.callback?.(12)).toBe(42);
    expect(reference.deref()).toBeDefined();
});

test("saved callback getters retain their callback through replacement, clearing, and collection", async () => {
    const object = new CallbackObject();
    const saved = (() => {
        const callback = (value: number): number => value + 17;
        object.callback = callback;
        const callable = object.callback;
        if (callable === null) throw new Error("The native callback property was empty");
        return { callable, reference: new WeakRef(callback) };
    })();
    object.callback = (value) => value + 1;
    await drainGC();
    expect(saved.callable(25)).toBe(42);
    expect(object.invoke(25)).toBe(26);
    object.callback = null;
    await drainGC();
    expect(saved.callable(25)).toBe(42);
    expect(saved.reference.deref()).toBeDefined();
    expect(object.invoke(25)).toBe(-1);
});

test("collecting a saved callback getter releases its superseded callback and captured object", async () => {
    const references = (() => {
        const object = new CallbackObject();
        const callback = (value: number): number => value + object.id;
        object.callback = callback;
        const saved = object.callback;
        if (saved === null) throw new Error("The native callback property was empty");
        object.callback = null;
        expect(saved(7)).toBe(object.id + 7);
        return {
            object: new WeakRef(object),
            callback: new WeakRef(callback),
            callable: new WeakRef(saved),
            id: object.id,
        };
    })();

    expect(
        await didSettle(
            () =>
                references.callable.deref() === undefined &&
                references.callback.deref() === undefined &&
                references.object.deref() === undefined &&
                wasFinalized(references.id) === true,
        ),
    ).toBe(true);
});

test("callback replacement during constructed retains the replacement after construction returns", async () => {
    const state: { replacement?: WeakRef<StoredCallback> } = {};
    class ReplaceDuringConstruction extends CallbackObject {
        vfuncConstructed(): void {
            const callback = (value: number): number => value + 30;
            state.replacement = new WeakRef(callback);
            this.callback = callback;
        }
    }
    const Registered = registerClass(ReplaceDuringConstruction, {
        typeName: "GtkxCallbackReplacementDuringConstruction",
    });
    const { object, original } = (() => {
        const callback = (value: number): number => value + 20;
        return { object: new Registered({ callback }), original: new WeakRef(callback) };
    })();

    expect(await didSettle(() => original.deref() === undefined)).toBe(true);
    expect(object.invoke(12)).toBe(42);
    expect(state.replacement?.deref()).toBeDefined();
});

test("clearing a callback during constructed releases the original after construction returns", async () => {
    class ClearDuringConstruction extends CallbackObject {
        vfuncConstructed(): void {
            this.callback = null;
        }
    }
    const Registered = registerClass(ClearDuringConstruction, { typeName: "GtkxCallbackClearDuringConstruction" });
    const { object, original } = (() => {
        const callback = (value: number): number => value + 20;
        return { object: new Registered({ callback }), original: new WeakRef(callback) };
    })();

    expect(await didSettle(() => original.deref() === undefined)).toBe(true);
    expect(object.callback).toBeNull();
    expect(object.invoke(12)).toBe(-1);
});

test("a callback getter saved during constructed survives clearing its original property", async () => {
    const state: { saved?: StoredCallback } = {};
    class SaveDuringConstruction extends CallbackObject {
        vfuncConstructed(): void {
            const callback = this.callback;
            if (callback === null) throw new Error("The construction callback was empty");
            state.saved = callback;
            this.callback = null;
        }
    }
    const Registered = registerClass(SaveDuringConstruction, { typeName: "GtkxSavedCallbackDuringConstruction" });
    const { object, original } = (() => {
        const callback = (value: number): number => value + 30;
        return { object: new Registered({ callback }), original: new WeakRef(callback) };
    })();

    await drainGC();
    expect(state.saved?.(12)).toBe(42);
    expect(original.deref()).toBeDefined();
    expect(object.callback).toBeNull();
    delete state.saved;
    expect(await didSettle(() => original.deref() === undefined)).toBe(true);
});

test("a callback getter saved by native setter reentry survives replacing the original property", async () => {
    const object = new CallbackObject();
    const state: { saved?: StoredCallback } = {};
    const original = (() => {
        const callback = (value: number): number => {
            if (value === 0) {
                const saved = object.callback;
                if (saved === null) throw new Error("The previous callback was empty");
                state.saved = saved;
            }
            return value + 30;
        };
        object.callback = callback;
        return new WeakRef(callback);
    })();

    await drainGC();
    invokeBeforeNextSet(getHandle(object));
    object.callback = (value) => value + 50;
    await drainGC();
    expect(state.saved?.(12)).toBe(42);
    expect(object.invoke(12)).toBe(62);
    object.callback = null;
    await drainGC();
    expect(state.saved?.(12)).toBe(42);
    delete state.saved;
    expect(await didSettle(() => original.deref() === undefined)).toBe(true);
});

test("reentrant callback property notification retains the innermost replacement", async () => {
    const object = new CallbackObject();
    const state: { replaced: boolean; replacement?: WeakRef<StoredCallback> } = { replaced: false };
    const replace = (): void => {
        if (state.replaced) return;
        state.replaced = true;
        expect(object.invoke(12)).toBe(32);
        const callback = (value: number): number => value + 30;
        state.replacement = new WeakRef(callback);
        object.callback = callback;
    };
    onSignal(object, "notify::callback", replace);
    const replaced = (() => {
        const callback = (value: number): number => value + 20;
        object.callback = callback;
        return new WeakRef(callback);
    })();
    offSignal(object, "notify::callback", replace);

    expect(state.replaced).toBe(true);
    expect(await didSettle(() => replaced.deref() === undefined)).toBe(true);
    expect(object.invoke(12)).toBe(42);
    expect(state.replacement?.deref()).toBeDefined();
});

test.each(["clear", "replace"] as const)(
    "a native setter retains its final callback after a nested %s before storing",
    async (change) => {
        const object = new CallbackObject();
        const state: { nested?: WeakRef<StoredCallback> } = {};
        const original = (() => {
            const callback = (): number => {
                if (change === "clear") {
                    object.callback = null;
                } else {
                    const replacement = (value: number): number => value + 50;
                    state.nested = new WeakRef(replacement);
                    object.callback = replacement;
                }
                return 0;
            };
            object.callback = callback;
            return new WeakRef(callback);
        })();
        invokeBeforeNextSet(getHandle(object));
        const incoming = (() => {
            const callback = (value: number): number => value + 30;
            object.callback = callback;
            return new WeakRef(callback);
        })();

        await drainGC();
        expect(incoming.deref()).toBeDefined();
        expect(object.invoke(12)).toBe(42);
        expect(object.callback?.(12)).toBe(42);
        expect(await didSettle(() => original.deref() === undefined && state.nested?.deref() === undefined)).toBe(true);
        object.callback = null;
        expect(await didSettle(() => incoming.deref() === undefined)).toBe(true);
    },
);

test.each([false, true])(
    "a native setter failure preserves the callback actually stored, afterStore=%s",
    async (afterStore) => {
        const { object, original } = (() => {
            const callback = (value: number): number => value + 30;
            return { object: new CallbackObject({ callback }), original: new WeakRef(callback) };
        })();
        failNextSet(getHandle(object), afterStore);
        const incoming = (() => {
            const callback = (value: number): number => value + 50;
            expect(() => {
                object.callback = callback;
            }).toThrow("fixture callback setter failed");
            return new WeakRef(callback);
        })();

        await drainGC();
        const retained = afterStore ? incoming : original;
        const released = afterStore ? original : incoming;
        expect(retained.deref()).toBeDefined();
        expect(object.invoke(12)).toBe(afterStore ? 62 : 42);
        expect(object.callback?.(12)).toBe(afterStore ? 62 : 42);
        expect(await didSettle(() => released.deref() === undefined)).toBe(true);
        object.callback = null;
        expect(await didSettle(() => retained.deref() === undefined)).toBe(true);
    },
);

test("reconciling a callback property preserves a replacement made by its getter", async () => {
    const object = new CallbackObject();
    const state: { replacement?: WeakRef<StoredCallback> } = {};
    invokeDuringNextGet(getHandle(object));
    const incoming = (() => {
        const callback = (value: number): number => {
            const replacement = (next: number): number => next + 50;
            state.replacement = new WeakRef(replacement);
            object.callback = replacement;
            return value + 30;
        };
        object.callback = callback;
        return new WeakRef(callback);
    })();

    await drainGC();
    expect(state.replacement?.deref()).toBeDefined();
    expect(object.invoke(12)).toBe(62);
    expect(object.callback?.(12)).toBe(62);
    object.callback = null;
    expect(await didSettle(() => incoming.deref() === undefined && state.replacement?.deref() === undefined)).toBe(
        true,
    );
});

test("a getter snapshot retains its callback when reading also replaces the property", async () => {
    const object = new CallbackObject();
    const original = (() => {
        const callback = (value: number): number => {
            if (value === 0) object.callback = (next) => next + 50;
            return value + 30;
        };
        object.callback = callback;
        return new WeakRef(callback);
    })();
    invokeDuringNextGet(getHandle(object));
    const state: { saved: StoredCallback | null } = { saved: object.callback };

    await drainGC();
    expect(original.deref()).toBeDefined();
    expect(state.saved?.(12)).toBe(42);
    expect(object.invoke(12)).toBe(62);
    expect(object.callback?.(12)).toBe(62);
    state.saved = null;
    expect(await didSettle(() => original.deref() === undefined)).toBe(true);
});

test("a property getter that writes on every read does not recurse through reconciliation", async () => {
    const object = new CallbackObject();
    invokeOnEveryGet(getHandle(object));
    const retained = (() => {
        const callback = (value: number): number => {
            if (value === 0) object.callback = callback;
            return value + 30;
        };
        object.callback = callback;
        return new WeakRef(callback);
    })();

    await drainGC();
    expect(retained.deref()).toBeDefined();
    expect(object.invoke(12)).toBe(42);
    expect(object.callback?.(12)).toBe(42);
    object.callback = null;
    expect(await didSettle(() => retained.deref() === undefined)).toBe(true);
});

test("write-only callback properties survive reentry and rejected writes without retaining unreachable objects", async () => {
    const references = await (async () => {
        const object = new CallbackObject();
        const original = (() => {
            const callback = (): number => {
                object.writeOnlyCallback = null;
                return 0;
            };
            object.writeOnlyCallback = callback;
            return new WeakRef(callback);
        })();
        invokeBeforeNextSet(getHandle(object));
        const incoming = (() => {
            const callback = (value: number): number => value + 30;
            object.writeOnlyCallback = callback;
            return new WeakRef(callback);
        })();

        await drainGC();
        expect(incoming.deref()).toBeDefined();
        expect(invokeWriteOnly(getHandle(object), 12)).toBe(42);
        failNextSet(getHandle(object), false);
        expect(() => {
            object.writeOnlyCallback = null;
        }).toThrow("fixture callback setter failed");
        await drainGC();
        expect(incoming.deref()).toBeDefined();
        expect(invokeWriteOnly(getHandle(object), 12)).toBe(42);
        return { object: new WeakRef(object), original, incoming, id: object.id };
    })();

    expect(
        await didSettle(
            () =>
                references.object.deref() === undefined &&
                references.original.deref() === undefined &&
                references.incoming.deref() === undefined &&
                wasFinalized(references.id) === true,
        ),
    ).toBe(true);
});

test("a failed reconciliation getter preserves the stored callback until a reliable read", async () => {
    const { object, original } = (() => {
        const callback = (value: number): number => value + 30;
        return { object: new CallbackObject({ callback }), original: new WeakRef(callback) };
    })();
    failNextGet(getHandle(object));
    const incoming = (() => {
        const callback = (value: number): number => value + 50;
        object.callback = callback;
        return new WeakRef(callback);
    })();

    await drainGC();
    expect(incoming.deref()).toBeDefined();
    expect(object.invoke(12)).toBe(62);
    expect(object.callback?.(12)).toBe(62);
    expect(await didSettle(() => original.deref() === undefined)).toBe(true);
    object.callback = null;
    expect(await didSettle(() => incoming.deref() === undefined)).toBe(true);
});

test.each(["clear", "replace"] as const)(
    "a stored callback can %s its own property before returning to native code",
    async (change) => {
        const object = new CallbackObject();
        const original = (() => {
            const callback = (value: number): number => {
                object.callback = change === "clear" ? null : (next) => next + 50;
                return value + 30;
            };
            object.callback = callback;
            return new WeakRef(callback);
        })();

        await drainGC();
        expect(object.invoke(12)).toBe(42);
        expect(await didSettle(() => original.deref() === undefined)).toBe(true);
        expect(object.invoke(12)).toBe(change === "clear" ? -1 : 62);
    },
);

test("a self-clearing callback remains alive until its outermost native invocation returns", async () => {
    const object = new CallbackObject();
    const original = (() => {
        const callback = (value: number): number => {
            if (value === 1) return object.invoke(0) + 1;
            object.callback = null;
            return 41;
        };
        object.callback = callback;
        return new WeakRef(callback);
    })();

    await drainGC();
    expect(object.invoke(1)).toBe(42);
    expect(await didSettle(() => original.deref() === undefined)).toBe(true);
    expect(object.invoke(1)).toBe(-1);
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

test("self-capturing callback properties allow their object and callback to be collected", async () => {
    const references = (() => {
        const object = new CallbackObject();
        const callback = (value: number): number => object.id + value;
        object.callback = callback;
        expect(object.invoke(7)).toBe(object.id + 7);
        return { object: new WeakRef(object), callback: new WeakRef(callback), id: object.id };
    })();

    expect(
        await didSettle(
            () =>
                references.object.deref() === undefined &&
                references.callback.deref() === undefined &&
                wasFinalized(references.id) === true,
        ),
    ).toBe(true);
});

test("native object ownership retains a callback until the native reference is released", async () => {
    const references = (() => {
        const object = new CallbackObject();
        const callback = (value: number): number => object.id + value;
        object.callback = callback;
        hold(getHandle(object));
        return { object: new WeakRef(object), callback: new WeakRef(callback), id: object.id };
    })();

    try {
        await drainGC();
        expect(invokeHeld(7)).toBe(references.id + 7);
        expect(wasFinalized(references.id)).toBe(false);
    } finally {
        release();
    }

    expect(
        await didSettle(
            () =>
                references.object.deref() === undefined &&
                references.callback.deref() === undefined &&
                wasFinalized(references.id) === true,
        ),
    ).toBe(true);
});
