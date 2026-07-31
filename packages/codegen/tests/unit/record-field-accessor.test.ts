import { describe, expect, it } from "vitest";
import type { GirNamespace } from "../../src/gir/namespace.js";
import type { FieldSlot } from "../../src/gir/size.js";
import { Library } from "../../src/gir/library.js";
import { emitFieldWrite } from "../../src/store/gi/record-field-accessor.js";
import { ModuleContext } from "../../src/writer/context.js";

const EMPTY_NAMESPACE: GirNamespace = {
    id: 0,
    name: "Test",
    sharedLibrary: undefined,
    cSymbolPrefixes: [],
    classes: [],
    interfaces: [],
    records: [],
    enums: [],
    callbacks: [],
    functions: [],
    constants: [],
    aliases: [],
};

const makeContext = (): ModuleContext => new ModuleContext(EMPTY_NAMESPACE, new Library());
const plainSlot = (byteOffset: number): FieldSlot => ({ byteOffset, bitOffset: undefined, bitWidth: undefined });

const bitfieldSlot = (byteOffset: number, bitOffset: number, bitWidth: number): FieldSlot => ({
    byteOffset,
    bitOffset,
    bitWidth,
});

describe("emitFieldWrite", () => {
    it("converts the value through toNative before writing it", () => {
        const statement = emitFieldWrite(makeContext(), {
            descriptor: "GDK_RGBA_DESCRIPTOR",
            slot: plainSlot(8),
            targetExpr: "handle",
            valueExpr: "props.color",
        });

        expect(statement).toBe("write(handle, GDK_RGBA_DESCRIPTOR, 8, toNative(GDK_RGBA_DESCRIPTOR, props.color));");
    });

    it("registers a runtime import for toNative", () => {
        const context = makeContext();

        emitFieldWrite(context, {
            descriptor: "GDK_RGBA_DESCRIPTOR",
            slot: plainSlot(8),
            targetExpr: "handle",
            valueExpr: "props.color",
        });

        expect(context.module.toSource()).toContain('import { toNative, write } from "@gtkx/runtime";');
    });

    it("leaves a bitfield merge untouched", () => {
        const statement = emitFieldWrite(makeContext(), {
            descriptor: "UINT32_DESCRIPTOR",
            slot: bitfieldSlot(0, 2, 3),
            targetExpr: "handle",
            valueExpr: "value",
        });

        expect(statement).not.toContain("toNative");
    });
});
