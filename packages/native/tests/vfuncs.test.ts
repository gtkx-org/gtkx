import { bindVfunc } from "@gtkx/native";
import { expect, test } from "vitest";

const DISPOSE_OFFSET = 40;
const USE_PLUGIN_OFFSET = 16;
const PLUGIN_VTABLE_SIZE = 48;

test("binding with neither an instance type nor an interface type throws", () => {
    expect(() =>
        bindVfunc({
            byteOffset: DISPOSE_OFFSET,
            label: "GObjectClass.dispose",
            argDescriptors: [],
            returnDescriptor: { kind: "void" },
        }),
    ).toThrow();
});

test("a zero instance type throws", () => {
    expect(() =>
        bindVfunc({
            instanceType: 0n,
            byteOffset: DISPOSE_OFFSET,
            label: "GObjectClass.dispose",
            argDescriptors: [],
            returnDescriptor: { kind: "void" },
        }),
    ).toThrow();
});

test("a zero interface type throws", () => {
    expect(() =>
        bindVfunc({
            interfaceType: 0n,
            byteOffset: USE_PLUGIN_OFFSET,
            vtableSize: PLUGIN_VTABLE_SIZE,
            label: "TypePluginInterface.usePlugin",
            argDescriptors: [],
            returnDescriptor: { kind: "void" },
        }),
    ).toThrow();
});

test("options missing a required field throw", () => {
    expect(() => bindVfunc({ label: "GObjectClass.dispose" } as never)).toThrow();
});
