import { describe, expect, it } from "vitest";
import * as runtime from "../src/runtime.js";

const EXPECTED_RUNTIME_EXPORTS = [
    "createRef",
    "promisify",
    "registerConstructionMeta",
    "getClassVFuncMeta",
    "getHandle",
    "registerClassVFuncMeta",
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
    "NativeError",
    "registerInterfaceVFuncMeta",
    "getNativeObject",
    "getNativeObjectAsInterface",
    "registerNativeClass",
    "registerNativeInterface",
    "connectSignal",
    "emitSignal",
    "registerSignalMeta",
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
