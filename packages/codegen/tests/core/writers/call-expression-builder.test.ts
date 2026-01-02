import { describe, expect, it } from "vitest";
import type { MappedType } from "../../../src/core/type-system/ffi-types.js";
import {
    CallExpressionBuilder,
    type CallExpressionOptions,
} from "../../../src/core/writers/call-expression-builder.js";
import { FfiTypeWriter } from "../../../src/core/writers/ffi-type-writer.js";
import { createTestProject, createTestSourceFile } from "../../fixtures/ts-morph-helpers.js";

function getCallExpressionOutput(builder: CallExpressionBuilder, options: CallExpressionOptions): string {
    const project = createTestProject();
    const sourceFile = createTestSourceFile(project, "test.ts");
    sourceFile.addVariableStatement({
        declarations: [{ name: "result", initializer: builder.toWriter(options) }],
    });
    return sourceFile.getFullText();
}

describe("CallExpressionBuilder", () => {
    describe("constructor", () => {
        it("creates builder with no ffiTypeWriter", () => {
            const builder = new CallExpressionBuilder();
            expect(builder).toBeInstanceOf(CallExpressionBuilder);
        });

        it("creates builder with custom ffiTypeWriter", () => {
            const ffiTypeWriter = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
            const builder = new CallExpressionBuilder(ffiTypeWriter);
            expect(builder).toBeInstanceOf(CallExpressionBuilder);
        });
    });

    describe("toWriter", () => {
        it("builds basic call expression", () => {
            const builder = new CallExpressionBuilder();
            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "gtk_button_new",
                args: [],
                returnType: { type: "gobject", ownership: "full" },
            });

            expect(output).toContain("call(");
            expect(output).toContain('"libgtk-4.so.1"');
            expect(output).toContain('"gtk_button_new"');
            expect(output).toContain('"gobject"');
        });

        it("builds call expression with arguments", () => {
            const builder = new CallExpressionBuilder();
            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "gtk_label_new",
                args: [{ type: { type: "string", ownership: "none" }, value: "label" }],
                returnType: { type: "gobject", ownership: "full" },
            });

            expect(output).toContain('"string"');
            expect(output).toContain("value: label");
        });

        it("builds call expression with multiple arguments", () => {
            const builder = new CallExpressionBuilder();
            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "gtk_box_new",
                args: [
                    { type: { type: "int", size: 32, unsigned: false }, value: "orientation" },
                    { type: { type: "int", size: 32, unsigned: false }, value: "spacing" },
                ],
                returnType: { type: "gobject", ownership: "full" },
            });

            expect(output).toContain("value: orientation");
            expect(output).toContain("value: spacing");
        });

        it("builds call expression with self argument", () => {
            const builder = new CallExpressionBuilder();
            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "gtk_button_set_label",
                args: [{ type: { type: "string", ownership: "none" }, value: "label" }],
                returnType: { type: "undefined" },
                selfArg: {
                    type: { type: "gobject", ownership: "none" },
                    value: "this.id",
                },
            });

            expect(output).toContain("value: this.id");
            expect(output).toContain("value: label");
        });

        it("places self argument before other arguments", () => {
            const builder = new CallExpressionBuilder();
            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "some_method",
                args: [{ type: { type: "int", size: 32, unsigned: false }, value: "arg1" }],
                returnType: { type: "undefined" },
                selfArg: {
                    type: { type: "gobject", ownership: "none" },
                    value: "self",
                },
            });

            const selfIndex = output.indexOf("value: self");
            const arg1Index = output.indexOf("value: arg1");
            expect(selfIndex).toBeLessThan(arg1Index);
        });

        it("builds call expression with optional argument", () => {
            const builder = new CallExpressionBuilder();
            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "gtk_widget_set_name",
                args: [{ type: { type: "string", ownership: "none" }, value: "name", optional: true }],
                returnType: { type: "undefined" },
                selfArg: {
                    type: { type: "gobject", ownership: "none" },
                    value: "this.id",
                },
            });

            expect(output).toContain("optional: true");
        });

        it("builds call expression with void return", () => {
            const builder = new CallExpressionBuilder();
            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "gtk_widget_show",
                args: [],
                returnType: { type: "undefined" },
                selfArg: {
                    type: { type: "gobject", ownership: "none" },
                    value: "this.id",
                },
            });

            expect(output).toContain('"undefined"');
        });

        it("builds call expression with boxed return type", () => {
            const ffiTypeWriter = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
            const builder = new CallExpressionBuilder(ffiTypeWriter);
            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "gdk_rgba_parse",
                args: [{ type: { type: "string", ownership: "none" }, value: "spec" }],
                returnType: {
                    type: "boxed",
                    ownership: "full",
                    innerType: "GdkRGBA",
                },
            });

            expect(output).toContain('"boxed"');
            expect(output).toContain('"GdkRGBA"');
        });

        it("builds call expression with array return type", () => {
            const builder = new CallExpressionBuilder();
            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "some_function",
                args: [],
                returnType: {
                    type: "array",
                    itemType: { type: "string", ownership: "full" },
                    ownership: "full",
                },
            });

            expect(output).toContain('"array"');
        });

        it("handles empty args array", () => {
            const builder = new CallExpressionBuilder();
            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "gtk_init",
                args: [],
                returnType: { type: "undefined" },
            });

            expect(output).toMatch(/\[\s*\]/);
        });

        it("uses custom ffiTypeWriter for argument types", () => {
            const ffiTypeWriter = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
            const builder = new CallExpressionBuilder(ffiTypeWriter);
            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "some_function",
                args: [
                    {
                        type: { type: "boxed", ownership: "none", innerType: "GdkRGBA" },
                        value: "color",
                    },
                ],
                returnType: { type: "undefined" },
            });

            expect(output).toContain('"libgtk-4.so.1"');
            expect(output).toContain('"GdkRGBA"');
        });
    });

    describe("buildValueExpression", () => {
        it("returns simple value for primitive types", () => {
            const builder = new CallExpressionBuilder();
            const mappedType: MappedType = {
                ts: "number",
                ffi: { type: "int", size: 32, unsigned: false },
            };

            const result = builder.buildValueExpression("count", mappedType);

            expect(result).toBe("count");
        });

        it("returns simple value for string type", () => {
            const builder = new CallExpressionBuilder();
            const mappedType: MappedType = {
                ts: "string",
                ffi: { type: "string", ownership: "none" },
            };

            const result = builder.buildValueExpression("label", mappedType);

            expect(result).toBe("label");
        });

        it("returns simple value for boolean type", () => {
            const builder = new CallExpressionBuilder();
            const mappedType: MappedType = {
                ts: "boolean",
                ffi: { type: "boolean" },
            };

            const result = builder.buildValueExpression("visible", mappedType);

            expect(result).toBe("visible");
        });

        it("returns ID extraction expression for gobject type", () => {
            const builder = new CallExpressionBuilder();
            const mappedType: MappedType = {
                ts: "Widget",
                ffi: { type: "gobject", ownership: "none" },
            };

            const result = builder.buildValueExpression("widget", mappedType);

            expect(result).toBe("(widget as any)?.id ?? widget");
        });

        it("returns ID extraction expression for boxed type", () => {
            const builder = new CallExpressionBuilder();
            const mappedType: MappedType = {
                ts: "GdkRGBA",
                ffi: { type: "boxed", ownership: "none", innerType: "GdkRGBA" },
            };

            const result = builder.buildValueExpression("color", mappedType);

            expect(result).toBe("(color as any)?.id ?? color");
        });

        it("returns ID extraction expression for struct type", () => {
            const builder = new CallExpressionBuilder();
            const mappedType: MappedType = {
                ts: "Allocation",
                ffi: { type: "struct", ownership: "none", innerType: "GtkAllocation" },
            };

            const result = builder.buildValueExpression("allocation", mappedType);

            expect(result).toBe("(allocation as any)?.id ?? allocation");
        });

        it("handles complex value names", () => {
            const builder = new CallExpressionBuilder();
            const mappedType: MappedType = {
                ts: "Widget",
                ffi: { type: "gobject", ownership: "none" },
            };

            const result = builder.buildValueExpression("this.child", mappedType);

            expect(result).toBe("(this.child as any)?.id ?? this.child");
        });

        it("handles array value names", () => {
            const builder = new CallExpressionBuilder();
            const mappedType: MappedType = {
                ts: "Widget",
                ffi: { type: "gobject", ownership: "none" },
            };

            const result = builder.buildValueExpression("widgets[0]", mappedType);

            expect(result).toBe("(widgets[0] as any)?.id ?? widgets[0]");
        });
    });

    describe("errorArgumentWriter", () => {
        it("builds error argument writer", () => {
            const ffiTypeWriter = new FfiTypeWriter({ glibLibrary: "libglib-2.0.so.0" });
            const builder = new CallExpressionBuilder(ffiTypeWriter);
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addVariableStatement({
                declarations: [{ name: "errorArg", initializer: builder.errorArgumentWriter() }],
            });
            const output = sourceFile.getFullText();

            expect(output).toContain("type:");
            expect(output).toContain('"ref"');
            expect(output).toContain("value: error");
        });

        it("throws when ffiTypeWriter has no glibLibrary", () => {
            const builder = new CallExpressionBuilder();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");

            expect(() => {
                sourceFile.addVariableStatement({
                    declarations: [{ name: "errorArg", initializer: builder.errorArgumentWriter() }],
                });
            }).toThrow("glibLibrary must be set");
        });
    });

    describe("errorCheckWriter", () => {
        it("builds error check code", () => {
            const builder = new CallExpressionBuilder();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addFunction({
                name: "test",
                statements: builder.errorCheckWriter(),
            });
            const output = sourceFile.getFullText();

            expect(output).toContain("if (error.value !== null)");
            expect(output).toContain("throw new NativeError(error.value)");
        });
    });

    describe("integration with FfiTypeWriter", () => {
        it("shares library context between builders", () => {
            const ffiTypeWriter = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
            const builder = new CallExpressionBuilder(ffiTypeWriter);

            ffiTypeWriter.setSharedLibrary("libgdk-4.so.1");

            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "test_fn",
                args: [
                    {
                        type: { type: "boxed", ownership: "none", innerType: "GdkRGBA" },
                        value: "color",
                    },
                ],
                returnType: { type: "undefined" },
            });

            expect(output).toContain('"libgdk-4.so.1"');
        });
    });

    describe("complex call expressions", () => {
        it("builds call with mixed argument types", () => {
            const ffiTypeWriter = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
            const builder = new CallExpressionBuilder(ffiTypeWriter);

            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "complex_function",
                args: [
                    { type: { type: "string", ownership: "none" }, value: "name" },
                    { type: { type: "int", size: 32, unsigned: false }, value: "count" },
                    { type: { type: "gobject", ownership: "none" }, value: "widget" },
                    { type: { type: "boolean" }, value: "enabled" },
                    {
                        type: { type: "boxed", ownership: "none", innerType: "GdkRGBA" },
                        value: "color",
                    },
                ],
                returnType: { type: "gobject", ownership: "full" },
                selfArg: {
                    type: { type: "gobject", ownership: "none" },
                    value: "this.id",
                },
            });

            expect(output).toContain("value: this.id");
            expect(output).toContain("value: name");
            expect(output).toContain("value: count");
            expect(output).toContain("value: widget");
            expect(output).toContain("value: enabled");
            expect(output).toContain("value: color");
            expect(output).toContain('"string"');
            expect(output).toContain('"int"');
            expect(output).toContain('"gobject"');
            expect(output).toContain('"boolean"');
            expect(output).toContain('"boxed"');
        });

        it("builds call with optional and required arguments", () => {
            const builder = new CallExpressionBuilder();
            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "test_function",
                args: [
                    { type: { type: "string", ownership: "none" }, value: "required1" },
                    { type: { type: "string", ownership: "none" }, value: "optional1", optional: true },
                    { type: { type: "int", size: 32, unsigned: false }, value: "required2" },
                    { type: { type: "int", size: 32, unsigned: false }, value: "optional2", optional: true },
                ],
                returnType: { type: "undefined" },
            });

            const optionalCount = (output.match(/optional: true/g) || []).length;
            expect(optionalCount).toBe(2);
        });

        it("builds call with nested type descriptors", () => {
            const ffiTypeWriter = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
            const builder = new CallExpressionBuilder(ffiTypeWriter);

            const output = getCallExpressionOutput(builder, {
                sharedLibrary: "libgtk-4.so.1",
                cIdentifier: "array_function",
                args: [
                    {
                        type: {
                            type: "array",
                            itemType: { type: "string", ownership: "none" },
                            ownership: "none",
                        },
                        value: "strings",
                    },
                ],
                returnType: {
                    type: "array",
                    itemType: { type: "gobject", ownership: "full" },
                    ownership: "full",
                },
            });

            expect(output).toContain('"array"');
            expect(output).toContain("itemType:");
        });
    });
});
