import type { ExternalObject, Handle } from "@gtkx/native";
import * as GdkPixbuf from "@gtkx/gi/gdkpixbuf";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { getHandle, promisify, setHandle } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const handle = (id: number): ExternalObject<Handle> => {
    const token: object = { id };

    return token as ExternalObject<Handle>;
};

const gobjectHandle = (): ExternalObject<Handle> => getHandle(new Gtk.Label({ label: "" }));

const invokeCallback = (...args: unknown[]): void => {
    (args.at(-1) as (source: ExternalObject<Handle>, result: ExternalObject<Handle>) => void)(
        handle(1),
        gobjectHandle(),
    );
};

const throwOnFinish = (failure: Error) => (): never => {
    throw failure;
};

const getRejection = async (promise: Promise<unknown>): Promise<unknown> => {
    try {
        await promise;
    } catch (error) {
        return error;
    }

    throw new Error("expected rejection");
};

describe("promisify", () => {
    it("forwards leading args, the resolved cancellable and the callback to the async fn", async () => {
        const calls: unknown[][] = [];

        const asyncFn = (...args: unknown[]): void => {
            calls.push(args);
            invokeCallback(...args);
        };

        const cancellable = {};
        const cancellableHandle = handle(99);
        setHandle(cancellable, cancellableHandle);
        const value = await promisify(asyncFn, () => "done", cancellable, "a", "b");
        expect(value).toBe("done");
        const args = calls[0] ?? [];
        expect(args.slice(0, 3)).toEqual(["a", "b", cancellableHandle]);
        expect(typeof args[3]).toBe("function");
    });

    it("forwards the already-wrapped GAsyncResult straight to the finish callable", async () => {
        const asyncResult = new Gtk.Label({ label: "" });

        const asyncFn = (...args: unknown[]): void => {
            (args.at(-1) as (source: object | null, result: object) => void)(null, asyncResult);
        };

        const resolvedHandle = await promisify(asyncFn, (result: object) => getHandle(result), undefined);
        expect(resolvedHandle).toBe(getHandle(asyncResult));
    });

    it("rejects with the error thrown by the finish callable", () => {
        const failure = new Error("boom");

        return expect(promisify(invokeCallback, throwOnFinish(failure), undefined)).rejects.toBe(failure);
    });

    it("attaches the creation call-site as the rejected error's cause", async () => {
        const failure = new Error("boom");
        const rejection = await getRejection(promisify(invokeCallback, throwOnFinish(failure), undefined));
        expect(rejection).toBeInstanceOf(Error);
        const cause = (rejection as Error).cause;
        expect(cause).toBeInstanceOf(Error);
        expect((cause as Error).message).toBe("GTKX async operation started here");
        expect((cause as Error).stack).toContain("promisify.test.ts");
    });
});

describe("generated promisified bindings", () => {
    it("resolves an instance async method against its annotated static finish", async () => {
        const pixbuf = GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, false, 8, 2, 2);
        const stream = Gio.MemoryOutputStream.newResizable();
        const isSaved = await pixbuf.saveToStreamvAsync(stream, "png", null, null);
        expect(isSaved).toBe(true);
        expect(stream.getDataSize()).toBeGreaterThan(0);
    });

    it("resolves an instance async method against a name-matched static finish", async () => {
        const firstOutput = Gio.MemoryOutputStream.newResizable();
        const secondOutput = Gio.MemoryOutputStream.newResizable();
        const first = Gio.SimpleIOStream.new(Gio.MemoryInputStream.newFromData([1, 2, 3, 4], null), firstOutput);
        const second = Gio.SimpleIOStream.new(Gio.MemoryInputStream.newFromData([5, 6], null), secondOutput);
        const isSpliced = await first.spliceAsync(second, Gio.IOStreamSpliceFlags.NONE, 0);
        expect(isSpliced).toBe(true);
        expect(secondOutput.getDataSize()).toBe(4);
        expect(firstOutput.getDataSize()).toBe(2);
    });
});
