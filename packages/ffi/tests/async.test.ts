import { getHandle, promisify, setHandle } from "@gtkx/ffi";
import * as Gtk from "@gtkx/gi/gtk";
import type { ExternalObject, Handle } from "@gtkx/native";
import { describe, expect, it } from "vitest";

const handle = (id: number): ExternalObject<Handle> => {
    const token: object = { id };
    return token as ExternalObject<Handle>;
};

const gobjectHandle = (): ExternalObject<Handle> => getHandle(new Gtk.Label({ label: "" }));

const invokeCallback = (...args: unknown[]): void => {
    (args[args.length - 1] as (source: ExternalObject<Handle>, result: ExternalObject<Handle>) => void)(
        handle(1),
        gobjectHandle(),
    );
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
            (args[args.length - 1] as (source: object | null, result: object) => void)(null, asyncResult);
        };

        const resolvedHandle = await promisify(asyncFn, (result: object) => getHandle(result), undefined);
        expect(resolvedHandle).toBe(getHandle(asyncResult));
    });

    it("rejects with the error thrown by the finish callable", () => {
        const failure = new Error("boom");

        return expect(
            promisify(
                invokeCallback,
                () => {
                    throw failure;
                },
                undefined,
            ),
        ).rejects.toBe(failure);
    });

    it("attaches the creation call-site as the rejected error's cause", () => {
        return promisify(
            invokeCallback,
            () => {
                throw new Error("boom");
            },
            undefined,
        ).then(
            () => {
                throw new Error("expected rejection");
            },
            (error: unknown) => {
                expect(error).toBeInstanceOf(Error);
                const cause = (error as Error).cause;
                expect(cause).toBeInstanceOf(Error);
                expect((cause as Error).message).toBe("gtkx async operation started here");
                expect((cause as Error).stack).toContain("async.test.ts");
            },
        );
    });
});
