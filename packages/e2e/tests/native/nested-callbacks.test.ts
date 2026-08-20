import * as Gio from "@gtkx/gi/gio";
import { Object as GObject } from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "../helpers/unique-name.js";

type LooseCallback = (...inputs: unknown[]) => unknown;

type InitAsyncImpl = (
    instance: GObject,
    ioPriority: number,
    cancellable: Gio.Cancellable | null,
    callback: Gio.AsyncReadyCallback | null,
) => void;

const uniqueName = createTypeNameFactory("NestedCallback");

const createAsyncInitable = (name: string, initAsyncImpl: InitAsyncImpl): GObject & Gio.AsyncInitable => {
    class TestAsyncInitable extends GObject implements Gio.AsyncInitableImpl {
        vfuncInitAsync(
            ioPriority: number,
            cancellable: Gio.Cancellable | null,
            callback: Gio.AsyncReadyCallback | null,
        ): void {
            initAsyncImpl(this, ioPriority, cancellable, callback);
        }
    }

    registerClass(TestAsyncInitable, { typeName: uniqueName(name), implements: [Gio.AsyncInitable] });

    return new TestAsyncInitable() as TestAsyncInitable & Gio.AsyncInitable;
};

const completedTask = (instance: GObject, cancellable: Gio.Cancellable | null): Gio.Task => {
    const task = Gio.Task.new(instance, cancellable, null);
    task.returnBoolean(true);

    return task;
};

describe("nested callbacks — happy path", () => {
    it("decodes the vfunc's callback into a callable that completes the async operation", async () => {
        const seen: unknown[] = [];

        const instance = createAsyncInitable("HappyInit", (self, ioPriority, cancellable, callback) => {
            seen.push(ioPriority, cancellable, typeof callback);
            callback?.(self, completedTask(self, cancellable), null);
        });

        await expect(instance.initAsync(7)).resolves.toBe(true);
        expect(seen).toEqual([7, null, "function"]);
    });

    it("round-trips a JavaScript callback through the vtable slot and back", () => {
        const received: unknown[] = [];

        const instance = createAsyncInitable("RoundTrip", (self, _ioPriority, cancellable, callback) => {
            callback?.(self, completedTask(self, cancellable), null);
        });

        instance.vfuncInitAsync(0, null, (sourceObject, res) => {
            received.push(sourceObject, res);
        });

        expect(received).toHaveLength(2);
        expect(received[0]).toBe(instance);
        expect(received[1]).toBeInstanceOf(Gio.Task);
    });
});

describe("nested callbacks — edge cases", () => {
    it("decodes a null callback as null", () => {
        const seen: unknown[] = [];

        const instance = createAsyncInitable("NullCallback", (_self, _ioPriority, _cancellable, callback) => {
            seen.push(callback);
        });

        instance.vfuncInitAsync(0, null, null);
        expect(seen).toEqual([null]);
    });

    it("ignores a data argument in favor of the bound user data", async () => {
        const instance = createAsyncInitable("BoundUserData", (self, _ioPriority, cancellable, callback) => {
            callback?.(self, completedTask(self, cancellable), 123n);
        });

        await expect(instance.initAsync(0)).resolves.toBe(true);
    });

    it("keeps an async-scoped callback callable after the vfunc returns", async () => {
        const state: { source: GObject | null; callback: Gio.AsyncReadyCallback | null } = {
            source: null,
            callback: null,
        };

        const instance = createAsyncInitable("DeferredCompletion", (self, _ioPriority, _cancellable, callback) => {
            state.source = self;
            state.callback = callback;
        });

        const pending = instance.initAsync(0);
        expect(state.callback).toBeTypeOf("function");
        state.callback?.(state.source, completedTask(instance, null), null);
        await expect(pending).resolves.toBe(true);
    });
});

describe("nested callbacks — error paths", () => {
    it("throws when an async-scoped callback is invoked a second time", async () => {
        const state: { callback: Gio.AsyncReadyCallback | null } = { callback: null };

        const instance = createAsyncInitable("DoubleCompletion", (_self, _ioPriority, _cancellable, callback) => {
            state.callback = callback;
        });

        const pending = instance.initAsync(0);
        const stored = state.callback;
        stored?.(instance, completedTask(instance, null), null);
        await expect(pending).resolves.toBe(true);
        expect(() => stored?.(instance, completedTask(instance, null), null)).toThrow();
    });

    it("throws when the decoded callable receives a non-object source", async () => {
        const state: { callback: Gio.AsyncReadyCallback | null } = { callback: null };

        const instance = createAsyncInitable("BadSource", (_self, _ioPriority, _cancellable, callback) => {
            state.callback = callback;
        });

        const pending = instance.initAsync(0);
        const stored = state.callback;
        expect(() => (stored as LooseCallback)("garbage", completedTask(instance, null), null)).toThrow();
        stored?.(instance, completedTask(instance, null), null);
        await expect(pending).resolves.toBe(true);
    });

    it("throws when the decoded callable receives a non-object result", async () => {
        const state: { callback: Gio.AsyncReadyCallback | null } = { callback: null };

        const instance = createAsyncInitable("BadResult", (_self, _ioPriority, _cancellable, callback) => {
            state.callback = callback;
        });

        const pending = instance.initAsync(0);
        const stored = state.callback;
        expect(() => (stored as LooseCallback)(instance, "garbage", null)).toThrow();
        stored?.(instance, completedTask(instance, null), null);
        await expect(pending).resolves.toBe(true);
    });
});
