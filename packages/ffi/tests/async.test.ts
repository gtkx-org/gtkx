import { getHandle, promisify, setHandle } from "@gtkx/ffi";
import type { NativeHandle } from "@gtkx/native";
import { describe, expect, it } from "vitest";

const handle = (id: number): NativeHandle => ({ id }) as unknown as NativeHandle;

describe("promisify", () => {
    it("forwards leading args, the resolved cancellable and the callback to the async fn", () => {
        const calls: unknown[][] = [];
        const asyncFn = (...args: unknown[]): void => {
            calls.push(args);
            const callback = args[args.length - 1] as (source: NativeHandle, result: NativeHandle) => void;
            callback(handle(1), handle(2));
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
            (args[args.length - 1] as (source: NativeHandle, result: NativeHandle) => void)(handle(1), handle(2));
        };

        return promisify(asyncFn, () => 0, undefined, { leading: ["lead"], trailing: ["progress"] }).then(() => {
            expect(captured.slice(0, 3)).toEqual(["lead", undefined, "progress"]);
            expect(typeof captured[3]).toBe("function");
        });
    });

    it("passes a wrapped GAsyncResult whose handle is the raw callback pointer", () => {
        const rawResult = handle(7);
        const asyncFn = (...args: unknown[]): void => {
            (args[args.length - 1] as (source: NativeHandle, result: NativeHandle) => void)(handle(1), rawResult);
        };

        return promisify(asyncFn, (result: object) => getHandle(result), undefined, { leading: [] }).then(
            (resolvedHandle) => {
                expect(resolvedHandle).toBe(rawResult);
            },
        );
    });

    it("rejects with the error thrown by the finish callable", () => {
        const failure = new Error("boom");
        const asyncFn = (...args: unknown[]): void => {
            (args[args.length - 1] as (source: NativeHandle, result: NativeHandle) => void)(handle(1), handle(2));
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
});
