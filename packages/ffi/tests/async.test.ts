import { getHandle, promisify, setHandle } from "@gtkx/ffi";
import * as Gtk from "@gtkx/gi/gtk";
import type { Handle } from "@gtkx/native";
import { describe, expect, it } from "vitest";

const handle = (id: number): Handle => {
    const token: object = { id };
    return token as Handle;
};

const gobjectHandle = (): Handle => getHandle(new Gtk.Label({ label: "" }));

describe("promisify", () => {
    it("forwards leading args, the resolved cancellable and the callback to the async fn", () => {
        const calls: unknown[][] = [];
        const asyncFn = (...args: unknown[]): void => {
            calls.push(args);
            const callback = args[args.length - 1] as (source: Handle, result: Handle) => void;
            callback(handle(1), gobjectHandle());
        };

        const cancellable = {};
        const cancellableHandle = handle(99);
        setHandle(cancellable, cancellableHandle);

        return promisify(asyncFn, () => "done", cancellable, { leading: ["a", "b"] }).then((value) => {
            expect(value).toBe("done");
            const args = calls[0] ?? [];
            expect(args.slice(0, 3)).toEqual(["a", "b", cancellableHandle]);
            expect(typeof args[3]).toBe("function");
        });
    });

    it("splices trailing args between the cancellable slot and the callback", () => {
        let captured: unknown[] = [];
        const asyncFn = (...args: unknown[]): void => {
            captured = args;
            (args[args.length - 1] as (source: Handle, result: Handle) => void)(handle(1), gobjectHandle());
        };

        return promisify(asyncFn, () => 0, undefined, { leading: ["lead"], trailing: ["progress"] }).then(() => {
            expect(captured.slice(0, 3)).toEqual(["lead", undefined, "progress"]);
            expect(typeof captured[3]).toBe("function");
        });
    });

    it("forwards the already-wrapped GAsyncResult straight to the finish callable", () => {
        const asyncResult = new Gtk.Label({ label: "" });
        const asyncFn = (...args: unknown[]): void => {
            (args[args.length - 1] as (source: object | null, result: object) => void)(null, asyncResult);
        };

        return promisify(asyncFn, (result: object) => getHandle(result), undefined, { leading: [] }).then(
            (resolvedHandle) => {
                expect(resolvedHandle).toBe(getHandle(asyncResult));
            },
        );
    });

    it("rejects with the error thrown by the finish callable", () => {
        const failure = new Error("boom");
        const asyncFn = (...args: unknown[]): void => {
            (args[args.length - 1] as (source: Handle, result: Handle) => void)(handle(1), gobjectHandle());
        };

        return expect(
            promisify(
                asyncFn,
                () => {
                    throw failure;
                },
                undefined,
                { leading: [] },
            ),
        ).rejects.toBe(failure);
    });

    it("splices the creation call-stack into the rejected error", () => {
        const asyncFn = (...args: unknown[]): void => {
            (args[args.length - 1] as (source: Handle, result: Handle) => void)(handle(1), gobjectHandle());
        };

        return promisify(
            asyncFn,
            () => {
                throw new Error("boom");
            },
            undefined,
            { leading: [] },
        ).then(
            () => {
                throw new Error("expected rejection");
            },
            (error: unknown) => {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).stack).toContain("### Promise created here: ###");
            },
        );
    });
});
