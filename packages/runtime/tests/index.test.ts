import * as runtime from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const EXPECTED_RUNTIME_EXPORTS = [
    "emitSignal",
    "connectSignal",
    "newObjectWithProperties",
    "getObjectProperty",
    "setObjectProperty",
    "getBoxedValue",
    "setBoxedValue",
    "promisify",
    "getHandle",
    "getInstanceType",
    "setHandle",
    "tryGetHandle",
    "t",
    "createErrorDomain",
    "registerWrapperClass",
    "getSignalBaseName",
    "fromNative",
    "alloc",
    "read",
    "write",
];

const NATIVE_TRANSPORT_PRIMITIVES = ["call"];

const PRIVATE_MARSHALLING_INTERNALS = [
    "toValue",
    "fromValue",
    "getValueType",
    "copyValue",
    "newValueForDescriptor",
    "outValueForDescriptor",
    "outValueForBoxedDescriptor",
    "inoutValueForBoxedDescriptor",
];

const expectExported = (names: string[], reason: string): void => {
    for (const name of names) {
        expect(runtime, `${reason}: ${name}`).toHaveProperty(name);
    }
};

const expectNotExported = (names: string[], reason: string): void => {
    for (const name of names) {
        expect(runtime, `${reason}: ${name}`).not.toHaveProperty(name);
    }
};

describe("runtime barrel", () => {
    it("exposes every helper symbol generated code depends on", () => {
        expectExported(EXPECTED_RUNTIME_EXPORTS, "missing runtime export");
    });

    it("does not re-export low-level transport primitives owned by `@gtkx/native`", () => {
        expectNotExported(NATIVE_TRANSPORT_PRIMITIVES, "unexpected native primitive re-export");
    });

    it("keeps the GValue marshalling primitives internal", () => {
        expectNotExported(PRIVATE_MARSHALLING_INTERNALS, "marshalling internal leaked to the barrel");
    });
});
