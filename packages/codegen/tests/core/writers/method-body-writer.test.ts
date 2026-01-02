import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../../src/core/generation-context.js";
import { FfiMapper } from "../../../src/core/type-system/ffi-mapper.js";
import type { MappedType } from "../../../src/core/type-system/ffi-types.js";
import { FfiTypeWriter } from "../../../src/core/writers/ffi-type-writer.js";
import { MethodBodyWriter } from "../../../src/core/writers/method-body-writer.js";
import {
    createNormalizedConstructor,
    createNormalizedMethod,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedType,
} from "../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../fixtures/mock-repository.js";
import { createTestProject, createTestSourceFile } from "../../fixtures/ts-morph-helpers.js";

function createTestSetup(namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map()) {
    const repo = createMockRepository(namespaces);
    const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
    const ctx = new GenerationContext();
    const ffiTypeWriter = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1", glibLibrary: "libglib-2.0.so.0" });
    const writer = new MethodBodyWriter(mapper, ctx, ffiTypeWriter);
    return { repo, mapper, ctx, ffiTypeWriter, writer };
}

describe("MethodBodyWriter", () => {
    describe("constructor", () => {
        it("creates writer with default FfiTypeWriter", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { mapper, ctx } = createTestSetup(new Map([["Gtk", ns]]));
            const writer = new MethodBodyWriter(mapper, ctx);
            expect(writer).toBeInstanceOf(MethodBodyWriter);
        });

        it("creates writer with custom FfiTypeWriter", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { mapper, ctx, ffiTypeWriter } = createTestSetup(new Map([["Gtk", ns]]));
            const writer = new MethodBodyWriter(mapper, ctx, ffiTypeWriter);
            expect(writer.getFfiTypeWriter()).toBe(ffiTypeWriter);
        });
    });

    describe("isVararg", () => {
        it("returns true for ... parameter", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const param = createNormalizedParameter({ name: "..." });

            expect(writer.isVararg(param)).toBe(true);
        });

        it("returns true for empty name parameter", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const param = createNormalizedParameter({ name: "" });

            expect(writer.isVararg(param)).toBe(true);
        });

        it("returns false for regular parameter", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const param = createNormalizedParameter({ name: "label" });

            expect(writer.isVararg(param)).toBe(false);
        });
    });

    describe("filterParameters", () => {
        it("filters out varargs parameters", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [createNormalizedParameter({ name: "label" }), createNormalizedParameter({ name: "..." })];

            const filtered = writer.filterParameters(params);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].name).toBe("label");
        });

        it("keeps regular parameters", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [createNormalizedParameter({ name: "label" }), createNormalizedParameter({ name: "icon" })];

            const filtered = writer.filterParameters(params);

            expect(filtered).toHaveLength(2);
        });

        it("handles empty parameter list", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));

            const filtered = writer.filterParameters([]);

            expect(filtered).toHaveLength(0);
        });
    });

    describe("hasRefParameter", () => {
        it("returns false for parameters without Ref type", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [createNormalizedParameter({ name: "label", type: createNormalizedType({ name: "utf8" }) })];

            expect(writer.hasRefParameter(params)).toBe(false);
        });

        it("returns true for out parameters (Ref type)", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [
                createNormalizedParameter({
                    name: "out_value",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                }),
            ];

            expect(writer.hasRefParameter(params)).toBe(true);
        });
    });

    describe("selectConstructors", () => {
        it("returns all constructors when none have unsupported callbacks", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const constructors = [
                createNormalizedConstructor({ name: "new" }),
                createNormalizedConstructor({
                    name: "new_with_label",
                    parameters: [createNormalizedParameter({ name: "label" })],
                }),
            ];

            const { supported, main } = writer.selectConstructors(constructors);

            expect(supported).toHaveLength(2);
            expect(main?.name).toBe("new");
        });

        it("identifies first non-vararg constructor as main", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const constructors = [
                createNormalizedConstructor({
                    name: "newv",
                    parameters: [createNormalizedParameter({ name: "..." })],
                }),
                createNormalizedConstructor({ name: "new" }),
            ];

            const { main } = writer.selectConstructors(constructors);

            expect(main?.name).toBe("new");
        });

        it("returns undefined main when all constructors have varargs", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const constructors = [
                createNormalizedConstructor({
                    name: "newv",
                    parameters: [createNormalizedParameter({ name: "..." })],
                }),
            ];

            const { main } = writer.selectConstructors(constructors);

            expect(main).toBeUndefined();
        });
    });

    describe("toJsParamName", () => {
        it("converts snake_case to camelCase", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const param = createNormalizedParameter({ name: "my_param_name" });

            expect(writer.toJsParamName(param)).toBe("myParamName");
        });

        it("handles reserved words", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const param = createNormalizedParameter({ name: "class" });

            expect(writer.toJsParamName(param)).toBe("class_");
        });

        it("handles simple names", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const param = createNormalizedParameter({ name: "label" });

            expect(writer.toJsParamName(param)).toBe("label");
        });
    });

    describe("needsObjectWrap", () => {
        it("returns needsGObjectWrap for gobject return type", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const mappedType: MappedType = {
                ts: "Button",
                ffi: { type: "gobject", ownership: "full" },
            };

            const result = writer.needsObjectWrap(mappedType);

            expect(result.needsWrap).toBe(true);
            expect(result.needsGObjectWrap).toBe(true);
            expect(result.needsBoxedWrap).toBe(false);
        });

        it("returns needsBoxedWrap for boxed return type", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const mappedType: MappedType = {
                ts: "RGBA",
                ffi: { type: "boxed", ownership: "full", innerType: "GdkRGBA" },
            };

            const result = writer.needsObjectWrap(mappedType);

            expect(result.needsWrap).toBe(true);
            expect(result.needsBoxedWrap).toBe(true);
        });

        it("returns needsGVariantWrap for gvariant return type", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const mappedType: MappedType = {
                ts: "Variant",
                ffi: { type: "gvariant", ownership: "full" },
            };

            const result = writer.needsObjectWrap(mappedType);

            expect(result.needsWrap).toBe(true);
            expect(result.needsGVariantWrap).toBe(true);
        });

        it("returns needsInterfaceWrap for interface return type", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const mappedType: MappedType = {
                ts: "Orientable",
                ffi: { type: "gobject", ownership: "full" },
                kind: "interface",
            };

            const result = writer.needsObjectWrap(mappedType);

            expect(result.needsWrap).toBe(true);
            expect(result.needsInterfaceWrap).toBe(true);
            expect(result.needsGObjectWrap).toBe(false);
        });

        it("returns needsArrayItemWrap for array of gobjects", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const mappedType: MappedType = {
                ts: "Widget[]",
                ffi: {
                    type: "array",
                    itemType: { type: "gobject", ownership: "none" },
                    ownership: "full",
                },
            };

            const result = writer.needsObjectWrap(mappedType);

            expect(result.needsArrayItemWrap).toBe(true);
            expect(result.arrayItemType).toBe("Widget");
        });

        it("does not need wrap for void return", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const mappedType: MappedType = {
                ts: "void",
                ffi: { type: "undefined" },
            };

            const result = writer.needsObjectWrap(mappedType);

            expect(result.needsWrap).toBe(false);
        });

        it("does not need wrap for primitive return", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const mappedType: MappedType = {
                ts: "number",
                ffi: { type: "int", size: 32, unsigned: false },
            };

            const result = writer.needsObjectWrap(mappedType);

            expect(result.needsWrap).toBe(false);
        });

        it("does not need wrap for string return", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const mappedType: MappedType = {
                ts: "string",
                ffi: { type: "string", ownership: "full" },
            };

            const result = writer.needsObjectWrap(mappedType);

            expect(result.needsWrap).toBe(false);
        });

        it("does not wrap unknown gobject types", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const mappedType: MappedType = {
                ts: "unknown",
                ffi: { type: "gobject", ownership: "full" },
            };

            const result = writer.needsObjectWrap(mappedType);

            expect(result.needsGObjectWrap).toBe(false);
        });
    });

    describe("getResultVarName", () => {
        it("returns 'result' when no parameter named result", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [createNormalizedParameter({ name: "label" })];

            expect(writer.getResultVarName(params)).toBe("result");
        });

        it("returns '_result' when parameter named result exists", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [createNormalizedParameter({ name: "result" })];

            expect(writer.getResultVarName(params)).toBe("_result");
        });

        it("handles snake_case 'result' conversion", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [createNormalizedParameter({ name: "result_value" })];

            expect(writer.getResultVarName(params)).toBe("result");
        });
    });

    describe("buildParameterList", () => {
        it("builds parameter list with types", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [
                createNormalizedParameter({ name: "label", type: createNormalizedType({ name: "utf8" }) }),
                createNormalizedParameter({ name: "count", type: createNormalizedType({ name: "gint" }) }),
            ];

            const result = writer.buildParameterList(params);

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe("label");
            expect(result[0].type).toBe("string");
            expect(result[1].name).toBe("count");
            expect(result[1].type).toBe("number");
        });

        it("marks nullable parameters as optional", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [
                createNormalizedParameter({
                    name: "label",
                    type: createNormalizedType({ name: "utf8", nullable: true }),
                    nullable: true,
                }),
            ];

            const result = writer.buildParameterList(params);

            expect(result[0].hasQuestionToken).toBe(true);
            expect(result[0].type).toBe("string | null");
        });

        it("propagates optional flag to subsequent parameters", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [
                createNormalizedParameter({
                    name: "optional_param",
                    type: createNormalizedType({ name: "utf8", nullable: true }),
                    nullable: true,
                }),
                createNormalizedParameter({
                    name: "required_param",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ];

            const result = writer.buildParameterList(params);

            expect(result[0].hasQuestionToken).toBe(true);
            expect(result[1].hasQuestionToken).toBe(true);
        });

        it("filters out varargs from parameter list", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [
                createNormalizedParameter({ name: "label", type: createNormalizedType({ name: "utf8" }) }),
                createNormalizedParameter({ name: "..." }),
            ];

            const result = writer.buildParameterList(params);

            expect(result).toHaveLength(1);
        });

        it("sets usesRef flag for Ref parameters", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer, ctx } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [
                createNormalizedParameter({
                    name: "out_value",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                }),
            ];

            writer.buildParameterList(params);

            expect(ctx.usesRef).toBe(true);
        });
    });

    describe("buildCallArgumentsArray", () => {
        it("builds call arguments for simple parameters", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [createNormalizedParameter({ name: "label", type: createNormalizedType({ name: "utf8" }) })];

            const args = writer.buildCallArgumentsArray(params);

            expect(args).toHaveLength(1);
            expect(args[0].value).toBe("label");
            expect(args[0].type.type).toBe("string");
        });

        it("converts snake_case parameter names", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [
                createNormalizedParameter({ name: "my_label", type: createNormalizedType({ name: "utf8" }) }),
            ];

            const args = writer.buildCallArgumentsArray(params);

            expect(args[0].value).toBe("myLabel");
        });

        it("marks nullable parameters as optional", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const params = [
                createNormalizedParameter({
                    name: "label",
                    type: createNormalizedType({ name: "utf8", nullable: true }),
                    nullable: true,
                }),
            ];

            const args = writer.buildCallArgumentsArray(params);

            expect(args[0].optional).toBe(true);
        });
    });

    describe("buildMethodStructure", () => {
        it("builds complete method structure", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const method = createNormalizedMethod({
                name: "get_label",
                cIdentifier: "gtk_button_get_label",
                returnType: createNormalizedType({ name: "utf8" }),
                parameters: [],
            });

            const structure = writer.buildMethodStructure(method, {
                methodName: "getLabel",
                selfTypeDescriptor: { type: "gobject", ownership: "none" },
                sharedLibrary: "libgtk-4.so.1",
                namespace: "Gtk",
            });

            expect(structure.name).toBe("getLabel");
            expect(structure.returnType).toBe("string");
            expect(structure.parameters).toHaveLength(0);
        });

        it("includes parameters in method structure", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const method = createNormalizedMethod({
                name: "set_label",
                cIdentifier: "gtk_button_set_label",
                returnType: createNormalizedType({ name: "none" }),
                parameters: [
                    createNormalizedParameter({ name: "label", type: createNormalizedType({ name: "utf8" }) }),
                ],
            });

            const structure = writer.buildMethodStructure(method, {
                methodName: "setLabel",
                selfTypeDescriptor: { type: "gobject", ownership: "none" },
                sharedLibrary: "libgtk-4.so.1",
                namespace: "Gtk",
            });

            expect(structure.parameters).toHaveLength(1);
            expect(structure.parameters?.[0].name).toBe("label");
        });

        it("handles void return type", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const method = createNormalizedMethod({
                name: "show",
                cIdentifier: "gtk_widget_show",
                returnType: createNormalizedType({ name: "none" }),
            });

            const structure = writer.buildMethodStructure(method, {
                methodName: "show",
                selfTypeDescriptor: { type: "gobject", ownership: "none" },
                sharedLibrary: "libgtk-4.so.1",
                namespace: "Gtk",
            });

            expect(structure.returnType).toBeUndefined();
        });

        it("handles nullable return type", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const method = createNormalizedMethod({
                name: "get_label",
                cIdentifier: "gtk_button_get_label",
                returnType: createNormalizedType({ name: "utf8", nullable: true }),
            });

            const structure = writer.buildMethodStructure(method, {
                methodName: "getLabel",
                selfTypeDescriptor: { type: "gobject", ownership: "none" },
                sharedLibrary: "libgtk-4.so.1",
                namespace: "Gtk",
            });

            expect(structure.returnType).toBe("string | null");
        });
    });

    describe("writeMethodBody", () => {
        it("generates method body with call expression", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const method = createNormalizedMethod({
                name: "get_label",
                cIdentifier: "gtk_button_get_label",
                returnType: createNormalizedType({ name: "utf8" }),
            });
            const returnTypeMapping: MappedType = {
                ts: "string",
                ffi: { type: "string", ownership: "full" },
            };

            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addClass({ name: "TestClass" }).addMethod({
                name: "getLabel",
                statements: writer.writeMethodBody(method, returnTypeMapping, {
                    sharedLibrary: "libgtk-4.so.1",
                    selfTypeDescriptor: { type: "gobject", ownership: "none" },
                }),
            });

            const output = sourceFile.getFullText();
            expect(output).toContain("call(");
            expect(output).toContain('"libgtk-4.so.1"');
            expect(output).toContain('"gtk_button_get_label"');
            expect(output).toContain("return");
        });

        it("includes self argument in call", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const method = createNormalizedMethod({
                name: "show",
                cIdentifier: "gtk_widget_show",
                returnType: createNormalizedType({ name: "none" }),
            });
            const returnTypeMapping: MappedType = {
                ts: "void",
                ffi: { type: "undefined" },
            };

            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addClass({ name: "TestClass" }).addMethod({
                name: "show",
                statements: writer.writeMethodBody(method, returnTypeMapping, {
                    sharedLibrary: "libgtk-4.so.1",
                    selfTypeDescriptor: { type: "gobject", ownership: "none" },
                }),
            });

            const output = sourceFile.getFullText();
            expect(output).toContain("this.id");
        });

        it("adds error handling for throwing methods", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer, ctx } = createTestSetup(new Map([["Gtk", ns]]));
            const method = createNormalizedMethod({
                name: "save",
                cIdentifier: "gtk_widget_save",
                returnType: createNormalizedType({ name: "gboolean" }),
                throws: true,
            });
            const returnTypeMapping: MappedType = {
                ts: "boolean",
                ffi: { type: "boolean" },
            };

            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addClass({ name: "TestClass" }).addMethod({
                name: "save",
                statements: writer.writeMethodBody(method, returnTypeMapping, {
                    sharedLibrary: "libgtk-4.so.1",
                    selfTypeDescriptor: { type: "gobject", ownership: "none" },
                }),
            });

            const output = sourceFile.getFullText();
            expect(output).toContain("const error = { value: null as unknown }");
            expect(output).toContain("if (error.value !== null)");
            expect(output).toContain("NativeError");
            expect(ctx.usesNativeError).toBe(true);
        });

        it("wraps gobject return values", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer, ctx } = createTestSetup(new Map([["Gtk", ns]]));
            const method = createNormalizedMethod({
                name: "get_parent",
                cIdentifier: "gtk_widget_get_parent",
                returnType: createNormalizedType({ name: "Gtk.Widget" }),
            });
            const returnTypeMapping: MappedType = {
                ts: "Widget",
                ffi: { type: "gobject", ownership: "none" },
            };

            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addClass({ name: "TestClass" }).addMethod({
                name: "getParent",
                statements: writer.writeMethodBody(method, returnTypeMapping, {
                    sharedLibrary: "libgtk-4.so.1",
                    selfTypeDescriptor: { type: "gobject", ownership: "none" },
                }),
            });

            const output = sourceFile.getFullText();
            expect(output).toContain("getNativeObject");
            expect(ctx.usesGetNativeObject).toBe(true);
        });
    });

    describe("writeFunctionBody", () => {
        it("generates function body without self argument", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const func = {
                name: "init",
                cIdentifier: "gtk_init",
                returnType: createNormalizedType({ name: "none" }),
                parameters: [],
                throws: false,
            };
            const returnTypeMapping: MappedType = {
                ts: "void",
                ffi: { type: "undefined" },
            };

            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addFunction({
                name: "init",
                statements: writer.writeFunctionBody(func, returnTypeMapping, {
                    sharedLibrary: "libgtk-4.so.1",
                }),
            });

            const output = sourceFile.getFullText();
            expect(output).toContain("call(");
            expect(output).toContain('"gtk_init"');
            expect(output).not.toContain("this.id");
        });
    });

    describe("writeFactoryMethodBody", () => {
        it("generates factory method with getNativeObject wrap", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer, ctx } = createTestSetup(new Map([["Gtk", ns]]));

            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addClass({ name: "Button" }).addMethod({
                name: "newWithLabel",
                isStatic: true,
                statements: writer.writeFactoryMethodBody({
                    sharedLibrary: "libgtk-4.so.1",
                    cIdentifier: "gtk_button_new_with_label",
                    args: [{ type: { type: "string", ownership: "none" }, value: "label" }],
                    returnTypeDescriptor: { type: "gobject", ownership: "full" },
                    wrapClassName: "Button",
                    throws: false,
                    useClassInWrap: false,
                }),
            });

            const output = sourceFile.getFullText();
            expect(output).toContain("const ptr = call(");
            expect(output).toContain("getNativeObject(ptr)");
            expect(output).toContain("as Button");
            expect(ctx.usesGetNativeObject).toBe(true);
        });

        it("generates factory method with class wrap for boxed types", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));

            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addClass({ name: "TextIter" }).addMethod({
                name: "new",
                isStatic: true,
                statements: writer.writeFactoryMethodBody({
                    sharedLibrary: "libgtk-4.so.1",
                    cIdentifier: "gtk_text_iter_new",
                    args: [],
                    returnTypeDescriptor: { type: "boxed", ownership: "full", innerType: "GtkTextIter" },
                    wrapClassName: "TextIter",
                    throws: false,
                    useClassInWrap: true,
                }),
            });

            const output = sourceFile.getFullText();
            expect(output).toContain("getNativeObject(ptr, TextIter)");
        });

        it("generates factory method with error handling", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer, ctx } = createTestSetup(new Map([["Gtk", ns]]));

            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");
            sourceFile.addClass({ name: "File" }).addMethod({
                name: "newForPath",
                isStatic: true,
                statements: writer.writeFactoryMethodBody({
                    sharedLibrary: "libgio-2.0.so.0",
                    cIdentifier: "g_file_new_for_path",
                    args: [{ type: { type: "string", ownership: "none" }, value: "path" }],
                    returnTypeDescriptor: { type: "gobject", ownership: "full" },
                    wrapClassName: "File",
                    throws: true,
                    useClassInWrap: false,
                }),
            });

            const output = sourceFile.getFullText();
            expect(output).toContain("const error = { value: null as unknown }");
            expect(output).toContain("if (error.value !== null)");
            expect(output).toContain("NativeError");
            expect(ctx.usesNativeError).toBe(true);
        });
    });

    describe("getters", () => {
        it("getFfiTypeWriter returns the FfiTypeWriter", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer, ffiTypeWriter } = createTestSetup(new Map([["Gtk", ns]]));

            expect(writer.getFfiTypeWriter()).toBe(ffiTypeWriter);
        });

        it("getFfiMapper returns the FfiMapper", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer, mapper } = createTestSetup(new Map([["Gtk", ns]]));

            expect(writer.getFfiMapper()).toBe(mapper);
        });

        it("getContext returns the GenerationContext", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer, ctx } = createTestSetup(new Map([["Gtk", ns]]));

            expect(writer.getContext()).toBe(ctx);
        });
    });

    describe("buildValueExpression", () => {
        it("delegates to CallExpressionBuilder", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const mappedType: MappedType = {
                ts: "Widget",
                ffi: { type: "gobject", ownership: "none" },
            };

            const result = writer.buildValueExpression("widget", mappedType);

            expect(result).toBe("(widget as any)?.id ?? widget");
        });

        it("returns simple value for primitives", () => {
            const ns = createNormalizedNamespace({ name: "Gtk" });
            const { writer } = createTestSetup(new Map([["Gtk", ns]]));
            const mappedType: MappedType = {
                ts: "number",
                ffi: { type: "int", size: 32, unsigned: false },
            };

            const result = writer.buildValueExpression("count", mappedType);

            expect(result).toBe("count");
        });
    });
});
