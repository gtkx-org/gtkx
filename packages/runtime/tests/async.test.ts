import { promisify, trimFinish } from "@gtkx/runtime";
import { expect, test } from "vitest";

const operation = (...args: unknown[]): void => {
    const callback = args.at(-1);

    if (typeof callback !== "function") {
        throw new Error("A completion callback is required");
    }

    const complete = callback as (source: null, result: { value: unknown }) => void;
    queueMicrotask(() => complete(null, { value: args[0] }));
};

test("asynchronous completion passes leading arguments through the finish function", async () => {
    const result = promisify(operation, (value: { value: number }) => value.value * 2, null, 21);

    await expect(result).resolves.toBe(42);
});

test("finish failures reject the operation without losing the original error", async () => {
    const error = new Error("finish failed");
    const result = promisify(
        operation,
        () => {
            throw error;
        },
        undefined,
        0,
    );

    await expect(result).rejects.toBe(error);
});

test("throwing starts reject and successful finish tuples discard the success flag", async () => {
    await expect(
        promisify(
            () => {
                throw new Error("start failed");
            },
            () => 0,
            null,
        ),
    ).rejects.toThrow("start failed");
    const finish = trimFinish((result: { value: number }): [boolean, number] => [true, result.value]);
    await expect(promisify(operation, finish, null, 42)).resolves.toBe(42);
});
