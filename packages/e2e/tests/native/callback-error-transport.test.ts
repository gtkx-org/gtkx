import * as GLib from "@gtkx/gi/glib";
import { bind, call, type CallbackFailure, type Ref } from "@gtkx/native";
import { fromNative, getHandle } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const library = fixtureLibrary("callback-error-transport");
const errorType = {
    kind: "boxed",
    typeName: "GError",
    ownership: "full",
    sharedLibrary: "libgobject-2.0.so.0",
    getTypeFnName: "g_error_get_type",
} as const;
const invoke = bind(
    library,
    "gtkx_callback_error_transport",
    [
        {
            kind: "callback",
            argDescriptors: [],
            returnDescriptor: { kind: "int32" },
            canThrow: true,
            scope: "call",
        },
        { kind: "ref", innerDescriptor: errorType },
    ],
    { kind: "int32" },
);

const invokeWithError = (callback: () => number, error: Ref | null): ReturnType<typeof call> =>
    call(invoke, [callback, error]);

const failure = (
    thrown: unknown,
): {
    transport: CallbackFailure & Error;
    error: GLib.Error;
    domain: GLib.Quark;
} => {
    const domain = GLib.quarkFromString("gtkx-native-callback-error");
    const error = GLib.Error.newLiteral(domain, 17, "failed");
    const transport = Object.assign(new Error("callback transport"), { nativeError: getHandle(error), thrown });

    return { transport, error, domain };
};

test("native callback success preserves its status and an empty GError slot", () => {
    const result = invokeWithError(() => 1, { value: null });
    expect(result.value).toBe(1);
    expect(result.outputs).toEqual([{ index: 1, value: null }]);
});

test("native callback failure copies a generated GError and preserves its owner", () => {
    const { transport, error, domain } = failure(new Error("failed"));
    expect(error.matches(domain, 17)).toBe(true);
    const result = invokeWithError(
        () => {
            throw transport;
        },
        { value: null },
    );
    expect(result.value).toBe(0);
    const output = result.outputs.find(({ index }) => index === 1);
    const copied = fromNative(errorType, output?.value);
    expect(copied).toBeInstanceOf(GLib.Error);
    if (!(copied instanceof GLib.Error)) {
        throw new Error("The callback did not return an error");
    }

    expect(copied.matches(domain, 17)).toBe(true);
    copied.code = 18;
    expect(error.matches(domain, 17)).toBe(true);
    expect(invokeWithError(() => 1, { value: null }).value).toBe(1);
});

test.each([
    { name: "Error", thrown: new Error("failed") },
    { name: "primitive", thrown: "failed" },
])("native callback transport propagates its $name without GError storage", ({ thrown }) => {
    const { transport } = failure(thrown);
    expect(() =>
        invokeWithError(() => {
            throw transport;
        }, null),
    ).toThrow();
    expect(invokeWithError(() => 1, null).value).toBe(1);
});

test("an unwrapped callback exception propagates without GError conversion", () => {
    expect(() =>
        invokeWithError(
            () => {
                throw new Error("failed");
            },
            { value: null },
        ),
    ).toThrow();
    expect(invokeWithError(() => 1, { value: null }).value).toBe(1);
});
