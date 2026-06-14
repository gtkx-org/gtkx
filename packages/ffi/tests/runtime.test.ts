import * as runtime from "@gtkx/ffi";
import { describe, expect, it } from "vitest";

const EXPECTED_RUNTIME_EXPORTS = [
    "ffiCall",
    "emitGobjectSignal",
    "connectGobjectSignal",
    "newGobjectWithProperties",
    "getGobjectProperty",
    "setGobjectProperty",
    "getGvalueBoxed",
    "setGvalueBoxed",
    "promisify",
    "getHandle",
    "setHandle",
    "tryGetHandle",
    "t",
    "checkError",
    "createErrorDomain",
    "registerNativeClass",
    "signalBaseName",
    "wrapFfiValue",
] as const;

const NATIVE_TRANSPORT_PRIMITIVES = ["alloc", "call", "read", "write", "freeze", "unfreeze"] as const;

const PRIVATE_MARSHALLING_INTERNALS = [
    "valueFromFfi",
    "valueToJS",
    "valueGetType",
    "valueFromObject",
    "outValueFromFfi",
    "outBoxedFromFfi",
    "inoutBoxedFromFfi",
    "signalDetailQuark",
    "getNativeObject",
    "getNativeObjectAsInterface",
    "GValue",
] as const;

describe("runtime barrel", () => {
    it("exposes every helper symbol generated code depends on", () => {
        for (const name of EXPECTED_RUNTIME_EXPORTS) {
            expect(runtime, `missing runtime export: ${name}`).toHaveProperty(name);
        }
    });

    it("does not re-export low-level transport primitives owned by `@gtkx/native`", () => {
        for (const name of NATIVE_TRANSPORT_PRIMITIVES) {
            expect(runtime, `unexpected native primitive re-export: ${name}`).not.toHaveProperty(name);
        }
    });

    it("keeps the GValue marshalling primitives internal", () => {
        for (const name of PRIVATE_MARSHALLING_INTERNALS) {
            expect(runtime, `marshalling internal leaked to the barrel: ${name}`).not.toHaveProperty(name);
        }
    });
});
