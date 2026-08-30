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

const createDeferredInit = (
    name: string,
): { instance: GObject & Gio.AsyncInitable; pending: Promise<boolean>; callback: Gio.AsyncReadyCallback } => {
    const state: { callback: Gio.AsyncReadyCallback | null } = { callback: null };
    const instance = createAsyncInitable(name, (_self, _ioPriority, _cancellable, callback) => {
        state.callback = callback;
    });
    const pending = instance.initAsync(0);
    const callback = state.callback;

    if (callback === null) {
        throw new TypeError("Async callback was not captured");
    }

    return { instance, pending, callback };
};

describe("nested callbacks", () => {
    it("happy path", async () => {
        const seen: unknown[] = [];

        const instance = createAsyncInitable("HappyInit", (self, ioPriority, cancellable, callback) => {
            seen.push(ioPriority, cancellable, typeof callback);
            callback?.(self, completedTask(self, cancellable), null);
        });

        await expect(instance.initAsync(7)).resolves.toBe(true);
        expect(seen).toEqual([7, null, "function"]);
    });

    it("edge cases", async () => {
        const nullCallbacks: (Gio.AsyncReadyCallback | null)[] = [];
        const nullInstance = createAsyncInitable("NullCallback", (_self, _ioPriority, _cancellable, callback) => {
            nullCallbacks.push(callback);
        });
        nullInstance.vfuncInitAsync(0, null, null);
        expect(nullCallbacks).toEqual([null]);

        const deferred = createDeferredInit("DeferredCompletion");
        deferred.callback(deferred.instance, completedTask(deferred.instance, null), 123n);
        await expect(deferred.pending).resolves.toBe(true);
    });

    it("error paths", async () => {
        const doubleCompletion = createDeferredInit("DoubleCompletion");
        doubleCompletion.callback(
            doubleCompletion.instance,
            completedTask(doubleCompletion.instance, null),
            null,
        );
        await doubleCompletion.pending;
        expect(() => {
            doubleCompletion.callback(
                doubleCompletion.instance,
                completedTask(doubleCompletion.instance, null),
                null,
            );
        }).toThrow();

        const badSource = createDeferredInit("BadSource");
        expect(() =>
            (badSource.callback as LooseCallback)("garbage", completedTask(badSource.instance, null), null),
        ).toThrow();
        badSource.callback(badSource.instance, completedTask(badSource.instance, null), null);
        await badSource.pending;

        const badResult = createDeferredInit("BadResult");
        expect(() => (badResult.callback as LooseCallback)(badResult.instance, "garbage", null)).toThrow();
        badResult.callback(badResult.instance, completedTask(badResult.instance, null), null);
        await badResult.pending;
    });
});
