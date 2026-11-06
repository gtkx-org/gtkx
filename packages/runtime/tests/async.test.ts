import {
    createErrorDomain,
    getHandle,
    promisify,
    read,
    registerWrapperClass,
    resolveType,
    t,
    trimFinish,
} from "@gtkx/runtime";
import { runInNewContext } from "node:vm";
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

class NativeError extends Error {
    get domain(): number {
        return read(getHandle(this), t.uint32, 0) as number;
    }

    get code(): number {
        return read(getHandle(this), t.int32, 4) as number;
    }
}

test("finish failures reject with the native GError and its domain", async () => {
    registerWrapperClass(NativeError, resolveType("libgobject-2.0.so.0", "g_error_get_type"));
    const regexQuark = t.bind("libglib-2.0.so.0", "g_regex_error_quark", [], t.uint32);
    const RegexError = createErrorDomain(() => regexQuark() as number, { COMPILE: 0 });
    const compileRegex = t.fn("libglib-2.0.so.0", "g_regex_new", {
        args: [{ type: t.string() }, { type: t.int32 }, { type: t.int32 }],
        returns: t.struct("full", { sharedLibrary: "libglib-2.0.so.0", freeFnName: "g_regex_unref" }),
        canThrow: true,
    });
    const result = promisify(operation, () => compileRegex("(", 0, 0), null);

    await expect(result).rejects.toBeInstanceOf(NativeError);
    await expect(result).rejects.toBeInstanceOf(RegexError);
});

test("finish failures preserve errors and their causes across realms", async () => {
    const error = runInNewContext("new Error('finish failed', { cause: new Error('original failure') })") as Error;
    const cause = error.cause;
    const result = promisify(
        operation,
        () => {
            throw error;
        },
        null,
    );

    await expect(result).rejects.toBe(error);
    expect(error.cause).toBe(cause);
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
