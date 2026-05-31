import { describe, expect, it } from "vitest";
import * as runtime from "../src/runtime.js";

const EXPECTED_RUNTIME_EXPORTS = [
    "promisify",
    "getHandle",
    "setHandle",
    "tryGetHandle",
    "alloc",
    "call",
    "freeze",
    "getNativeId",
    "read",
    "t",
    "unfreeze",
    "write",
    "checkError",
    "makeErrorDomain",
    "registerNativeClass",
    "getNativeObject",
    "getNativeObjectAsInterface",
    "connectSignal",
    "emitSignal",
] as const;

describe("runtime barrel", () => {
    it("exposes every value symbol generated code depends on", () => {
        for (const name of EXPECTED_RUNTIME_EXPORTS) {
            expect(runtime, `missing runtime export: ${name}`).toHaveProperty(name);
        }
    });

    it("does not re-export `constructNativeObject` so the barrel stays acyclic", () => {
        expect(runtime).not.toHaveProperty("constructNativeObject");
    });
});
