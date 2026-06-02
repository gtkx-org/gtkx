import * as runtime from "@gtkx/ffi";
import { describe, expect, it } from "vitest";

const EXPECTED_RUNTIME_EXPORTS = [
    "promisify",
    "getHandle",
    "setHandle",
    "tryGetHandle",
    "t",
    "checkError",
    "createErrorDomain",
    "registerNativeClass",
    "getNativeObject",
    "getNativeObjectAsInterface",
    "connectSignal",
    "signalBaseName",
] as const;

const NATIVE_TRANSPORT_PRIMITIVES = ["alloc", "call", "read", "write", "freeze", "unfreeze"] as const;

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

    it("does not re-export `constructNativeObject` so the barrel stays acyclic", () => {
        expect(runtime).not.toHaveProperty("constructNativeObject");
    });
});
