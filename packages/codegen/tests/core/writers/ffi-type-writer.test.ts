import { describe, expect, it } from "vitest";
import type { FfiTypeDescriptor } from "../../../src/core/type-system/ffi-types.js";
import { FfiTypeWriter } from "../../../src/core/writers/ffi-type-writer.js";
import { createTestProject, createTestSourceFile } from "../../fixtures/ts-morph-helpers.js";

function getWriterOutput(writer: FfiTypeWriter, type: FfiTypeDescriptor): string {
    const project = createTestProject();
    const sourceFile = createTestSourceFile(project, "test.ts");
    sourceFile.addVariableStatement({
        declarations: [{ name: "TYPE", initializer: writer.toWriter(type) }],
    });
    return sourceFile.getFullText().replace("const TYPE = ", "").replace(";", "").trim();
}

describe("FfiTypeWriter", () => {
    describe("constructor", () => {
        it("creates writer with no options", () => {
            const writer = new FfiTypeWriter();
            expect(writer).toBeInstanceOf(FfiTypeWriter);
        });

        it("creates writer with currentSharedLibrary option", () => {
            const writer = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
            expect(writer).toBeInstanceOf(FfiTypeWriter);
        });

        it("creates writer with glibLibrary option", () => {
            const writer = new FfiTypeWriter({ glibLibrary: "libglib-2.0.so.0" });
            expect(writer).toBeInstanceOf(FfiTypeWriter);
        });
    });

    describe("setSharedLibrary", () => {
        it("sets the current shared library", () => {
            const writer = new FfiTypeWriter();
            writer.setSharedLibrary("libgtk-4.so.1");

            const output = getWriterOutput(writer, {
                type: "boxed",
                ownership: "full",
                innerType: "GdkRGBA",
            });

            expect(output).toContain('"libgtk-4.so.1"');
        });

        it("overrides previously set library", () => {
            const writer = new FfiTypeWriter({ currentSharedLibrary: "libold.so" });
            writer.setSharedLibrary("libnew.so");

            const output = getWriterOutput(writer, {
                type: "boxed",
                ownership: "full",
                innerType: "SomeType",
            });

            expect(output).toContain('"libnew.so"');
            expect(output).not.toContain('"libold.so"');
        });
    });

    describe("createGErrorRefTypeDescriptor", () => {
        it("creates GError ref type descriptor", () => {
            const writer = new FfiTypeWriter({ glibLibrary: "libglib-2.0.so.0" });
            const descriptor = writer.createGErrorRefTypeDescriptor();

            expect(descriptor).toEqual({
                type: "ref",
                innerType: {
                    type: "boxed",
                    ownership: "full",
                    innerType: "GError",
                    lib: "libglib-2.0.so.0",
                },
            });
        });

        it("throws when glibLibrary is not set", () => {
            const writer = new FfiTypeWriter();
            expect(() => writer.createGErrorRefTypeDescriptor()).toThrow(
                "glibLibrary must be set in FfiTypeWriterOptions for GError types",
            );
        });
    });

    describe("toWriter", () => {
        describe("int types", () => {
            it("writes signed 32-bit int", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "int", size: 32, unsigned: false });

                expect(output).toContain('"int"');
                expect(output).toContain("size: 32");
                expect(output).toContain("unsigned: false");
            });

            it("writes unsigned 32-bit int", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "int", size: 32, unsigned: true });

                expect(output).toContain("unsigned: true");
            });

            it("writes 64-bit int", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "int", size: 64, unsigned: false });

                expect(output).toContain("size: 64");
            });

            it("writes 8-bit int", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "int", size: 8, unsigned: true });

                expect(output).toContain("size: 8");
                expect(output).toContain("unsigned: true");
            });

            it("defaults to 32-bit signed when size not specified", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "int" } as FfiTypeDescriptor);

                expect(output).toContain("size: 32");
                expect(output).toContain("unsigned: false");
            });
        });

        describe("float types", () => {
            it("writes 64-bit float (double)", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "float", size: 64 });

                expect(output).toContain('"float"');
                expect(output).toContain("size: 64");
            });

            it("writes 32-bit float", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "float", size: 32 });

                expect(output).toContain("size: 32");
            });

            it("defaults to 64-bit when size not specified", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "float" } as FfiTypeDescriptor);

                expect(output).toContain("size: 64");
            });
        });

        describe("string type", () => {
            it("writes string with full ownership", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "string", ownership: "full" });

                expect(output).toContain('"string"');
                expect(output).toContain('"full"');
            });

            it("writes string with no ownership", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "string", ownership: "none" });

                expect(output).toContain('"none"');
            });

            it("defaults to full ownership", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "string" } as FfiTypeDescriptor);

                expect(output).toContain('"full"');
            });
        });

        describe("gobject type", () => {
            it("writes gobject with full ownership", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "gobject", ownership: "full" });

                expect(output).toContain('"gobject"');
                expect(output).toContain('"full"');
            });

            it("writes gobject with no ownership", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "gobject", ownership: "none" });

                expect(output).toContain('"gobject"');
                expect(output).toContain('"none"');
            });
        });

        describe("gparam type", () => {
            it("writes gparam with ownership", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "gparam", ownership: "none" });

                expect(output).toContain('"gparam"');
                expect(output).toContain('"none"');
            });
        });

        describe("gvariant type", () => {
            it("writes gvariant with ownership", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "gvariant", ownership: "full" });

                expect(output).toContain('"gvariant"');
                expect(output).toContain('"full"');
            });
        });

        describe("boxed type", () => {
            it("writes boxed type with all properties", () => {
                const writer = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
                const output = getWriterOutput(writer, {
                    type: "boxed",
                    ownership: "full",
                    innerType: "GdkRGBA",
                });

                expect(output).toContain('"boxed"');
                expect(output).toContain('"full"');
                expect(output).toContain('"GdkRGBA"');
                expect(output).toContain('"libgtk-4.so.1"');
            });

            it("writes boxed type with explicit lib", () => {
                const writer = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
                const output = getWriterOutput(writer, {
                    type: "boxed",
                    ownership: "full",
                    innerType: "PangoAttrList",
                    lib: "libpango-1.0.so.0",
                });

                expect(output).toContain('"libpango-1.0.so.0"');
                expect(output).not.toContain('"libgtk-4.so.1"');
            });

            it("writes boxed type with getTypeFn", () => {
                const writer = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
                const output = getWriterOutput(writer, {
                    type: "boxed",
                    ownership: "full",
                    innerType: "GdkRGBA",
                    getTypeFn: "gdk_rgba_get_type",
                });

                expect(output).toContain('"gdk_rgba_get_type"');
            });

            it("converts GVariant boxed to gvariant type", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "boxed",
                    ownership: "full",
                    innerType: "GVariant",
                });

                expect(output).toContain('"gvariant"');
                expect(output).not.toContain('"boxed"');
            });

            it("uses empty lib when none available", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "boxed",
                    ownership: "full",
                    innerType: "SomeType",
                });

                expect(output).toContain('lib: ""');
            });
        });

        describe("struct type", () => {
            it("writes struct type", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "struct",
                    ownership: "full",
                    innerType: "GtkAllocation",
                });

                expect(output).toContain('"struct"');
                expect(output).toContain('"full"');
                expect(output).toContain('"GtkAllocation"');
            });

            it("writes struct with no ownership", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "struct",
                    ownership: "none",
                    innerType: "SomeStruct",
                });

                expect(output).toContain('"none"');
            });
        });

        describe("ref type", () => {
            it("writes ref type with nested inner type", () => {
                const writer = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
                const output = getWriterOutput(writer, {
                    type: "ref",
                    innerType: {
                        type: "boxed",
                        ownership: "full",
                        innerType: "GdkRGBA",
                    },
                });

                expect(output).toContain('"ref"');
                expect(output).toContain("innerType:");
                expect(output).toContain('"boxed"');
            });

            it("writes ref type for primitive", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "ref",
                    innerType: { type: "int", size: 32, unsigned: false },
                });

                expect(output).toContain('"ref"');
                expect(output).toContain('"int"');
            });
        });

        describe("array type", () => {
            it("writes array type with item type", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "array",
                    itemType: { type: "string", ownership: "full" },
                    ownership: "full",
                });

                expect(output).toContain('"array"');
                expect(output).toContain("itemType:");
                expect(output).toContain('"string"');
            });

            it("writes array type with listType", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "array",
                    listType: "glist",
                    ownership: "full",
                });

                expect(output).toContain('"glist"');
            });

            it("defaults listType to array", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "array",
                    ownership: "full",
                });

                expect(output).toContain('listType: "array"');
            });

            it("writes array of gobjects", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "array",
                    itemType: { type: "gobject", ownership: "none" },
                    ownership: "none",
                });

                expect(output).toContain('"gobject"');
            });
        });

        describe("callback type", () => {
            it("writes callback type with trampoline", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "callback",
                    trampoline: "closure",
                });

                expect(output).toContain('"callback"');
                expect(output).toContain('"closure"');
            });

            it("writes callback with argTypes", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "callback",
                    trampoline: "closure",
                    argTypes: [
                        { type: "gobject", ownership: "none" },
                        { type: "string", ownership: "none" },
                    ],
                });

                expect(output).toContain("argTypes:");
                expect(output).toContain('"gobject"');
                expect(output).toContain('"string"');
            });

            it("writes callback with sourceType", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "callback",
                    trampoline: "closure",
                    sourceType: { type: "gobject", ownership: "none" },
                });

                expect(output).toContain("sourceType:");
            });

            it("writes callback with resultType", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "callback",
                    trampoline: "closure",
                    resultType: { type: "boolean" },
                });

                expect(output).toContain("resultType:");
            });

            it("writes callback with returnType", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, {
                    type: "callback",
                    trampoline: "closure",
                    returnType: { type: "int", size: 32, unsigned: false },
                });

                expect(output).toContain("returnType:");
            });

            it("defaults trampoline to closure", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "callback" } as FfiTypeDescriptor);

                expect(output).toContain('"closure"');
            });
        });

        describe("simple types", () => {
            it("writes boolean type", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "boolean" });

                expect(output).toContain('"boolean"');
            });

            it("writes undefined type", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "undefined" });

                expect(output).toContain('"undefined"');
            });

            it("writes null type", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "null" });

                expect(output).toContain('"null"');
            });
        });

        describe("unknown types", () => {
            it("writes unknown type as string", () => {
                const writer = new FfiTypeWriter();
                const output = getWriterOutput(writer, { type: "custom" } as FfiTypeDescriptor);

                expect(output).toContain('"custom"');
            });
        });
    });

    describe("errorArgumentWriter", () => {
        it("writes error argument descriptor", () => {
            const writer = new FfiTypeWriter({ glibLibrary: "libglib-2.0.so.0" });
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addVariableStatement({
                declarations: [{ name: "ERROR", initializer: writer.errorArgumentWriter() }],
            });
            const output = sourceFile.getFullText();

            expect(output).toContain('"ref"');
            expect(output).toContain('"boxed"');
            expect(output).toContain('"GError"');
            expect(output).toContain('"libglib-2.0.so.0"');
        });

        it("throws when glibLibrary is not set", () => {
            const writer = new FfiTypeWriter();
            expect(() => writer.errorArgumentWriter()).toThrow(
                "glibLibrary must be set in FfiTypeWriterOptions for GError types",
            );
        });
    });

    describe("selfArgumentWriter", () => {
        it("writes gobject self argument by default", () => {
            const writer = new FfiTypeWriter();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addVariableStatement({
                declarations: [{ name: "SELF", initializer: writer.selfArgumentWriter({}) }],
            });
            const output = sourceFile.getFullText();

            expect(output).toContain('"gobject"');
            expect(output).toContain('"none"');
        });

        it("writes gparam self argument when isParamSpec is true", () => {
            const writer = new FfiTypeWriter();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addVariableStatement({
                declarations: [{ name: "SELF", initializer: writer.selfArgumentWriter({ isParamSpec: true }) }],
            });
            const output = sourceFile.getFullText();

            expect(output).toContain('"gparam"');
            expect(output).toContain('"none"');
        });

        it("writes boxed self argument for records", () => {
            const writer = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addVariableStatement({
                declarations: [
                    {
                        name: "SELF",
                        initializer: writer.selfArgumentWriter({
                            isRecord: true,
                            recordName: "GdkRGBA",
                        }),
                    },
                ],
            });
            const output = sourceFile.getFullText();

            expect(output).toContain('"boxed"');
            expect(output).toContain('"none"');
            expect(output).toContain('"GdkRGBA"');
            expect(output).toContain('"libgtk-4.so.1"');
        });

        it("uses explicit sharedLibrary for records when provided", () => {
            const writer = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addVariableStatement({
                declarations: [
                    {
                        name: "SELF",
                        initializer: writer.selfArgumentWriter({
                            isRecord: true,
                            recordName: "PangoAttrList",
                            sharedLibrary: "libpango-1.0.so.0",
                        }),
                    },
                ],
            });
            const output = sourceFile.getFullText();

            expect(output).toContain('"libpango-1.0.so.0"');
        });

        it("uses empty lib when no library available for records", () => {
            const writer = new FfiTypeWriter();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addVariableStatement({
                declarations: [
                    {
                        name: "SELF",
                        initializer: writer.selfArgumentWriter({
                            isRecord: true,
                            recordName: "SomeRecord",
                        }),
                    },
                ],
            });
            const output = sourceFile.getFullText();

            expect(output).toContain('lib: ""');
        });
    });

    describe("complex nested types", () => {
        it("writes deeply nested ref of array of boxed", () => {
            const writer = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
            const output = getWriterOutput(writer, {
                type: "ref",
                innerType: {
                    type: "array",
                    itemType: {
                        type: "boxed",
                        ownership: "full",
                        innerType: "GdkRGBA",
                    },
                    ownership: "full",
                },
            });

            expect(output).toContain('"ref"');
            expect(output).toContain('"array"');
            expect(output).toContain('"boxed"');
            expect(output).toContain('"GdkRGBA"');
        });

        it("writes callback with complex argument types", () => {
            const writer = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
            const output = getWriterOutput(writer, {
                type: "callback",
                trampoline: "closure",
                argTypes: [
                    { type: "gobject", ownership: "none" },
                    {
                        type: "array",
                        itemType: { type: "string", ownership: "none" },
                        ownership: "none",
                    },
                ],
                returnType: { type: "boolean" },
            });

            expect(output).toContain('"callback"');
            expect(output).toContain('"gobject"');
            expect(output).toContain('"array"');
            expect(output).toContain('"boolean"');
        });
    });
});
