import * as runtime from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const EXPECTED_RUNTIME_EXPORTS = [
    "emitSignal",
    "connectSignal",
    "newObjectWithProperties",
    "registerConstructProperties",
    "getObjectProperty",
    "setObjectProperty",
    "getBoxedValue",
    "setBoxedValue",
    "promisify",
    "getHandle",
    "getInstanceType",
    "setHandle",
    "t",
    "createErrorDomain",
    "registerWrapperClass",
    "getSignalBaseName",
    "fromNative",
    "toNative",
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

const barrelNames: Set<string> = new Set(Object.keys(runtime));

const absentFromBarrel = (names: string[]): string[] => names.filter((name) => !barrelNames.has(name));
const presentInBarrel = (names: string[]): string[] => names.filter((name) => barrelNames.has(name));

describe("runtime barrel", () => {
    it("exposes every helper symbol generated code depends on", () => {
        expect(absentFromBarrel(EXPECTED_RUNTIME_EXPORTS), "missing runtime exports").toEqual([]);
    });

    it("does not re-export low-level transport primitives owned by `@gtkx/native`", () => {
        expect(presentInBarrel(NATIVE_TRANSPORT_PRIMITIVES), "unexpected native primitive re-exports").toEqual([]);
    });

    it("keeps the GValue marshalling primitives internal", () => {
        expect(presentInBarrel(PRIVATE_MARSHALLING_INTERNALS), "marshalling internals leaked to the barrel").toEqual(
            [],
        );
    });
});
