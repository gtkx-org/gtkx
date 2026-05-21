import { describe, expect, it } from "vitest";
import { fileBuilder } from "../../src/builders/file-builder.js";
import { Writer } from "../../src/builders/text-writer.js";
import { FfiDescriptorRegistry } from "../../src/ffi-emitters/descriptor-registry.js";
import { FfiTypeWriter } from "../../src/ffi-emitters/ffi-type-writer.js";
import { addTypeImports, type ImportCollector, MethodBodyWriter } from "../../src/ffi-emitters/method-body-writer.js";
import { FfiMapper } from "../../src/type-system/ffi-mapper.js";
import type { MappedType } from "../../src/type-system/ffi-types.js";
import { isVararg } from "../../src/utils/filtering.js";
import {
    createNormalizedCallback,
    createNormalizedClass,
    createNormalizedConstructor,
    createNormalizedFunction,
    createNormalizedInterface,
    createNormalizedMethod,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedRecord,
    createNormalizedType,
    qualifiedName,
} from "../fixtures/gir-fixtures.js";
import { createMockRepository } from "../fixtures/mock-repository.js";

function createTestSetup(namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map()) {
    const repo = createMockRepository(namespaces);
    const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "Gtk");
    const imports = fileBuilder();
    const ffiTypeWriter = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1", glibLibrary: "libglib-2.0.so.0" });
    const writer = new MethodBodyWriter(mapper, imports, ffiTypeWriter);
    return { repo, mapper, imports, ffiTypeWriter, writer };
}

describe("MethodBodyWriter / constructor", () => {
    it("creates writer with default FfiTypeWriter", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { mapper, imports } = createTestSetup(new Map([["Gtk", ns]]));
        const writer = new MethodBodyWriter(mapper, imports);
        expect(writer).toBeInstanceOf(MethodBodyWriter);
    });
});

describe("MethodBodyWriter / isVararg (standalone function)", () => {
    it("returns true for ... parameter", () => {
        const param = createNormalizedParameter({ name: "..." });

        expect(isVararg(param)).toBe(true);
    });

    it("returns true for empty name parameter", () => {
        const param = createNormalizedParameter({ name: "" });

        expect(isVararg(param)).toBe(true);
    });

    it("returns false for regular parameter", () => {
        const param = createNormalizedParameter({ name: "label" });

        expect(isVararg(param)).toBe(false);
    });
});

describe("MethodBodyWriter / filterParameters", () => {
    it("filters out varargs parameters", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const params = [createNormalizedParameter({ name: "label" }), createNormalizedParameter({ name: "..." })];

        const filtered = writer.filterParameters(params);

        expect(filtered).toHaveLength(1);
        expect(filtered[0]?.name).toBe("label");
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

describe("MethodBodyWriter / selectConstructors", () => {
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

describe("MethodBodyWriter / toJsParamName", () => {
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

describe("MethodBodyWriter / needsObjectWrap (1)", () => {
    it("returns needsGObjectWrap for gobject return type", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const mappedType: MappedType = {
            imports: [],
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
            imports: [],
            ts: "RGBA",
            ffi: { type: "boxed", ownership: "full", innerType: "GdkRGBA" },
        };

        const result = writer.needsObjectWrap(mappedType);

        expect(result.needsWrap).toBe(true);
        expect(result.needsBoxedWrap).toBe(true);
    });

    it("returns needsFundamentalWrap for fundamental return type", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const mappedType: MappedType = {
            imports: [],
            ts: "RenderNode",
            ffi: { type: "fundamental", ownership: "full" },
        };

        const result = writer.needsObjectWrap(mappedType);

        expect(result.needsWrap).toBe(true);
        expect(result.needsFundamentalWrap).toBe(true);
    });
});

describe("MethodBodyWriter / needsObjectWrap (2)", () => {
    it("returns needsInterfaceWrap for interface return type", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const mappedType: MappedType = {
            imports: [],
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
            imports: [],
            ts: "Widget[]",
            ffi: {
                type: "array",
                itemType: { type: "gobject", ownership: "borrowed" },
                ownership: "full",
            },
        };

        const result = writer.needsObjectWrap(mappedType);

        expect(result.needsArrayItemWrap).toBe(true);
        expect(result.arrayItemType).toBe("Widget");
    });
});

describe("MethodBodyWriter / needsObjectWrap (3)", () => {
    it("does not need wrap for void return", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const mappedType: MappedType = {
            imports: [],
            ts: "void",
            ffi: { type: "void" },
        };

        const result = writer.needsObjectWrap(mappedType);

        expect(result.needsWrap).toBe(false);
    });

    it("does not need wrap for primitive return", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const mappedType: MappedType = {
            imports: [],
            ts: "number",
            ffi: { type: "int32" },
        };

        const result = writer.needsObjectWrap(mappedType);

        expect(result.needsWrap).toBe(false);
    });

    it("does not need wrap for string return", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const mappedType: MappedType = {
            imports: [],
            ts: "string",
            ffi: { type: "string", ownership: "full" },
        };

        const result = writer.needsObjectWrap(mappedType);

        expect(result.needsWrap).toBe(false);
    });
});

describe("MethodBodyWriter / needsObjectWrap (4)", () => {
    it("does not wrap unknown gobject types", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const mappedType: MappedType = {
            imports: [],
            ts: "unknown",
            ffi: { type: "gobject", ownership: "full" },
        };

        const result = writer.needsObjectWrap(mappedType);

        expect(result.needsGObjectWrap).toBe(false);
    });
});

describe("MethodBodyWriter / getResultVarName", () => {
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

describe("MethodBodyWriter / buildParameterList (1)", () => {
    it("builds parameter list with types", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const params = [
            createNormalizedParameter({ name: "label", type: createNormalizedType({ name: "utf8" }) }),
            createNormalizedParameter({ name: "count", type: createNormalizedType({ name: "gint" }) }),
        ];

        const result = writer.buildParameterList(params);

        expect(result).toHaveLength(2);
        expect(result[0]?.name).toBe("label");
        expect(result[0]?.type).toBe("string");
        expect(result[1]?.name).toBe("count");
        expect(result[1]?.type).toBe("number");
    });

    it("marks nullable parameters as required with a nullable type", () => {
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

        expect(result[0]?.optional).toBeFalsy();
        expect(result[0]?.type).toBe("string | null");
    });
});

describe("MethodBodyWriter / buildParameterList (2)", () => {
    it("marks optional-only parameters without null type", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const params = [
            createNormalizedParameter({
                name: "label",
                type: createNormalizedType({ name: "utf8" }),
                optional: true,
            }),
        ];

        const result = writer.buildParameterList(params);

        expect(result[0]?.optional).toBe(true);
        expect(result[0]?.type).toBe("string");
    });

    it("preserves GIR parameter order even when a nullable param precedes a required one", () => {
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

        expect(result[0]?.name).toBe("optionalParam");
        expect(result[0]?.optional).toBeFalsy();
        expect(result[0]?.type).toBe("string | null");
        expect(result[1]?.name).toBe("requiredParam");
        expect(result[1]?.optional).toBeFalsy();
    });
});

describe("MethodBodyWriter / buildParameterList (3)", () => {
    it("converts varargs to rest parameter", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const params = [
            createNormalizedParameter({ name: "label", type: createNormalizedType({ name: "utf8" }) }),
            createNormalizedParameter({ name: "..." }),
        ];

        const result = writer.buildParameterList(params);

        expect(result).toHaveLength(2);
        expect(result[0]?.name).toBe("label");
        expect(result[1]?.name).toBe("args");
        expect(result[1]?.isRestParameter).toBe(true);
    });

    it("hides out parameters from the signature", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const params = [
            createNormalizedParameter({
                name: "out_value",
                type: createNormalizedType({ name: "gint" }),
                direction: "out",
            }),
        ];

        const result = writer.buildParameterList(params);

        expect(result).toHaveLength(0);
    });
});

describe("MethodBodyWriter / buildParameterList (4)", () => {
    it("keeps inout primitive parameters in the signature as plain values", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const params = [
            createNormalizedParameter({
                name: "value",
                type: createNormalizedType({ name: "gint" }),
                direction: "inout",
            }),
        ];

        const result = writer.buildParameterList(params);

        expect(result).toHaveLength(1);
        expect(result[0]?.type).toBe("number");
    });
});

describe("MethodBodyWriter / buildMethodStructure (1)", () => {
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
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
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
            parameters: [createNormalizedParameter({ name: "label", type: createNormalizedType({ name: "utf8" }) })],
        });

        const structure = writer.buildMethodStructure(method, {
            methodName: "setLabel",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
            sharedLibrary: "libgtk-4.so.1",
            namespace: "Gtk",
        });

        expect(structure.parameters).toHaveLength(1);
        expect(structure.parameters?.[0]?.name).toBe("label");
    });
});

describe("MethodBodyWriter / buildMethodStructure (2)", () => {
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
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
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
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
            sharedLibrary: "libgtk-4.so.1",
            namespace: "Gtk",
        });

        expect(structure.returnType).toBe("string | null");
    });
});

describe("MethodBodyWriter / writeMethodBody (1)", () => {
    it("generates method body with call expression", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "get_label",
            cIdentifier: "gtk_button_get_label",
            returnType: createNormalizedType({ name: "utf8" }),
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
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
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("getHandle(this)");
    });
});

describe("MethodBodyWriter / writeMethodBody (2)", () => {
    it("adds error handling for throwing methods", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "save",
            cIdentifier: "gtk_widget_save",
            returnType: createNormalizedType({ name: "gboolean" }),
            throws: true,
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("const error = createRef(null)");
        expect(output).toContain("checkError(error, GLib.Error)");
    });

    it("wraps gobject return values", () => {
        const ns = createNormalizedNamespace({
            name: "Gtk",
            classes: new Map([["Widget", createNormalizedClass({ name: "Widget", glibTypeName: "GtkWidget" })]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "get_parent",
            cIdentifier: "gtk_widget_get_parent",
            returnType: createNormalizedType({ name: "Widget" }),
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("getNativeObject");
    });
});

describe("MethodBodyWriter / writeFunctionBody", () => {
    it("generates function body without self argument", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const func = createNormalizedFunction({
            name: "init",
            cIdentifier: "gtk_init",
            returnType: createNormalizedType({ name: "none" }),
            parameters: [],
            throws: false,
        });
        const shape = writer.buildShape(func.parameters, func.returnType, 0);

        const w = new Writer();
        writer.writeFunctionBody(func, shape, {
            sharedLibrary: "libgtk-4.so.1",
        })(w);

        const output = w.toString();
        expect(output).toContain("call(");
        expect(output).toContain('"gtk_init"');
        expect(output).not.toContain("getHandle(this)");
    });
});

describe("MethodBodyWriter / writeFactoryMethodBody (1)", () => {
    it("generates factory method with getNativeObject wrap", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const w = new Writer();
        writer.writeFactoryMethodBody({
            sharedLibrary: "libgtk-4.so.1",
            cIdentifier: "gtk_button_new_with_label",
            args: [{ type: { type: "string", ownership: "borrowed" }, value: "label" }],
            returnTypeDescriptor: { type: "gobject", ownership: "full" },
            wrapClassName: "Button",
            throws: false,
            useClassInWrap: false,
        })(w);

        const output = w.toString();
        expect(output).toContain("const ptr = call(");
        expect(output).toContain("return getNativeObject(ptr);");
    });

    it("generates factory method with class wrap for boxed types", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const w = new Writer();
        writer.writeFactoryMethodBody({
            sharedLibrary: "libgtk-4.so.1",
            cIdentifier: "gtk_text_iter_new",
            args: [],
            returnTypeDescriptor: { type: "boxed", ownership: "full", innerType: "GtkTextIter" },
            wrapClassName: "TextIter",
            throws: false,
            useClassInWrap: true,
        })(w);

        const output = w.toString();
        expect(output).toContain("getNativeObject(ptr, TextIter)");
    });
});

describe("MethodBodyWriter / writeFactoryMethodBody (2)", () => {
    it("generates factory method with error handling", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const w = new Writer();
        writer.writeFactoryMethodBody({
            sharedLibrary: "libgio-2.0.so.0",
            cIdentifier: "g_file_new_for_path",
            args: [{ type: { type: "string", ownership: "borrowed" }, value: "path" }],
            returnTypeDescriptor: { type: "gobject", ownership: "full" },
            wrapClassName: "File",
            throws: true,
            useClassInWrap: false,
        })(w);

        const output = w.toString();
        expect(output).toContain("const error = createRef(null)");
        expect(output).toContain("checkError(error, GLib.Error)");
    });
});

function createImportCollector(): {
    collector: ImportCollector;
    imports: string[];
    typeImports: string[];
    namespaceImports: string[];
} {
    const imports: string[] = [];
    const typeImports: string[] = [];
    const namespaceImports: string[] = [];
    const collector: ImportCollector = {
        addImport(specifier, names) {
            imports.push(`${specifier}:${names.join(",")}`);
        },
        addTypeImport(specifier, names) {
            typeImports.push(`${specifier}:${names.join(",")}`);
        },
        addNamespaceImport(specifier, alias) {
            namespaceImports.push(`${specifier}:${alias}`);
        },
    };
    return { collector, imports, typeImports, namespaceImports };
}

describe("addTypeImports (1)", () => {
    it("imports enums from the enums module", () => {
        const { collector, imports } = createImportCollector();

        addTypeImports(collector, [
            { kind: "enum", name: "Orientation", namespace: "Gtk", transformedName: "Orientation", isExternal: false },
        ]);

        expect(imports).toContain("./enums.js:Orientation");
    });

    it("imports flags from the enums module", () => {
        const { collector, imports } = createImportCollector();

        addTypeImports(collector, [
            { kind: "flags", name: "StateFlags", namespace: "Gtk", transformedName: "StateFlags", isExternal: false },
        ]);

        expect(imports).toContain("./enums.js:StateFlags");
    });

    it("imports records and classes from their kebab-cased module", () => {
        const { collector, imports } = createImportCollector();

        addTypeImports(collector, [
            { kind: "class", name: "TextView", namespace: "Gtk", transformedName: "TextView", isExternal: false },
            { kind: "record", name: "TextIter", namespace: "Gtk", transformedName: "TextIter", isExternal: false },
        ]);

        expect(imports).toContain("./text-view.js:TextView");
        expect(imports).toContain("./text-iter.js:TextIter");
    });

    it("imports aliases from the aliases module", () => {
        const { collector, imports } = createImportCollector();

        addTypeImports(collector, [
            { kind: "alias", name: "Allocation", namespace: "Gtk", transformedName: "Allocation", isExternal: false },
        ]);

        expect(imports).toContain("./aliases.js:Allocation");
    });
});

describe("addTypeImports (2)", () => {
    it("imports external types as a namespace import", () => {
        const { collector, namespaceImports } = createImportCollector();

        addTypeImports(collector, [
            { kind: "class", name: "Application", namespace: "Gio", transformedName: "Application", isExternal: true },
        ]);

        expect(namespaceImports).toContain("../../gio/index.js:Gio");
    });

    it("skips internal names listed in skipNames", () => {
        const { collector, imports } = createImportCollector();

        addTypeImports(
            collector,
            [{ kind: "class", name: "Button", namespace: "Gtk", transformedName: "Button", isExternal: false }],
            new Set(["Button"]),
        );

        expect(imports).toHaveLength(0);
    });

    it("emits nothing for callback imports", () => {
        const { collector, imports, typeImports, namespaceImports } = createImportCollector();

        addTypeImports(collector, [
            {
                kind: "callback",
                name: "TickCallback",
                namespace: "Gtk",
                transformedName: "TickCallback",
                isExternal: false,
            },
        ]);

        expect(imports).toHaveLength(0);
        expect(typeImports).toHaveLength(0);
        expect(namespaceImports).toHaveLength(0);
    });
});

describe("MethodBodyWriter - extended coverage / setSelfNames", () => {
    it("excludes self names from method structure type imports", () => {
        const widgetClass = createNormalizedClass({ name: "Widget", glibTypeName: "GtkWidget" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            classes: new Map([["Widget", widgetClass]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        writer.setSelfNames(new Set(["Widget"]));

        const method = createNormalizedMethod({
            name: "get_parent",
            cIdentifier: "gtk_widget_get_parent",
            returnType: createNormalizedType({ name: "Widget" }),
        });

        const structure = writer.buildMethodStructure(method, {
            methodName: "getParent",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
            sharedLibrary: "libgtk-4.so.1",
            namespace: "Gtk",
        });

        expect(structure.name).toBe("getParent");
    });
});

describe("MethodBodyWriter - extended coverage / isReturnTypeUnsafe", () => {
    it("returns false for null return type", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        expect(writer.isReturnTypeUnsafe(null)).toBe(false);
    });

    it("returns false for void return type", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        expect(writer.isReturnTypeUnsafe(createNormalizedType({ name: "void" }))).toBe(false);
    });

    it("returns false for a string return type", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        expect(writer.isReturnTypeUnsafe(createNormalizedType({ name: "utf8" }))).toBe(false);
    });

    it("returns true for a raw pointer return type", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        expect(writer.isReturnTypeUnsafe(createNormalizedType({ name: "gpointer" }))).toBe(true);
    });
});

describe("MethodBodyWriter - extended coverage / resolveMethodName", () => {
    it("applies a dynamic rename when one is registered", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({ name: "get_label", cIdentifier: "gtk_button_get_label" });

        const name = writer.resolveMethodName(method, new Map([["gtk_button_get_label", "label"]]));

        expect(name).toBe("label");
    });

    it("falls back to the camelCased name when no rename exists", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({ name: "get_label", cIdentifier: "gtk_button_get_label" });

        expect(writer.resolveMethodName(method, new Map())).toBe("getLabel");
    });
});

describe("MethodBodyWriter - extended coverage / selectConstructors - unsupported", () => {
    it("classifies constructors with unsupported callbacks as unsupported", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const constructors = [
            createNormalizedConstructor({ name: "new" }),
            createNormalizedConstructor({
                name: "new_from_closure",
                parameters: [
                    createNormalizedParameter({
                        name: "closure",
                        type: createNormalizedType({ name: "GLib.Closure" }),
                    }),
                ],
            }),
        ];

        const { supported, unsupported } = writer.selectConstructors(constructors);

        expect(supported.map((c) => c.name)).toEqual(["new"]);
        expect(unsupported.map((c) => c.name)).toEqual(["new_from_closure"]);
    });
});

describe("MethodBodyWriter - extended coverage / hasUnsupportedCallbacks", () => {
    it("returns true when a parameter has a raw pointer type", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const params = [createNormalizedParameter({ name: "data", type: createNormalizedType({ name: "gpointer" }) })];

        expect(writer.hasUnsupportedCallbacks(params)).toBe(true);
    });

    it("returns false when every parameter marshals safely", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const params = [createNormalizedParameter({ name: "label", type: createNormalizedType({ name: "utf8" }) })];

        expect(writer.hasUnsupportedCallbacks(params)).toBe(false);
    });
});

describe("MethodBodyWriter - extended coverage / computeReturnTypeString (1)", () => {
    it("returns void when the callable has no return and no out params", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const shape = writer.buildShape([], createNormalizedType({ name: "none" }), 0);

        expect(writer.computeReturnTypeString(shape, undefined)).toBe("void");
    });

    it("returns the original return type when there are no out params", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const shape = writer.buildShape([], createNormalizedType({ name: "utf8" }), 0);

        expect(writer.computeReturnTypeString(shape, undefined)).toBe("string");
    });

    it("uses the own class name for self-returning callables", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const shape = writer.buildShape([], createNormalizedType({ name: "utf8" }), 0);

        expect(writer.computeReturnTypeString(shape, "Button")).toBe("Button");
    });

    it("returns a single out param type when there is no original return", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const params = [
            createNormalizedParameter({
                name: "out_value",
                type: createNormalizedType({ name: "gint" }),
                direction: "out",
            }),
        ];
        const shape = writer.buildShape(params, createNormalizedType({ name: "none" }), 0);

        expect(writer.computeReturnTypeString(shape, undefined)).toBe("number");
    });
});

describe("MethodBodyWriter - extended coverage / computeReturnTypeString (2)", () => {
    it("returns a tuple when there is a return value plus an out param", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const params = [
            createNormalizedParameter({
                name: "out_value",
                type: createNormalizedType({ name: "gint" }),
                direction: "out",
            }),
        ];
        const shape = writer.buildShape(params, createNormalizedType({ name: "gboolean" }), 0);

        expect(writer.computeReturnTypeString(shape, undefined)).toBe("[boolean, number]");
    });
});

describe("MethodBodyWriter - extended coverage / buildStaticFunctionStructure", () => {
    it("builds a static function structure with no parameters", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const func = createNormalizedFunction({
            name: "get_default",
            cIdentifier: "gtk_settings_get_default",
            returnType: createNormalizedType({ name: "utf8" }),
        });

        const structure = writer.buildStaticFunctionStructure(func, {
            className: "Settings",
            originalClassName: "Settings",
            sharedLibrary: "libgtk-4.so.1",
            namespace: "Gtk",
        });

        expect(structure.isStatic).toBe(true);
        expect(structure.name).toBe("getDefault");
        expect(structure.returnType).toBe("string");
    });

    it("returns the own class type when the function returns its own class", () => {
        const textIter = createNormalizedRecord({
            name: "TextIter",
            qualifiedName: qualifiedName("Gtk", "TextIter"),
            glibTypeName: "GtkTextIter",
            glibGetType: "gtk_text_iter_get_type",
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([["TextIter", textIter]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const func = createNormalizedFunction({
            name: "copy",
            cIdentifier: "gtk_text_iter_copy",
            returnType: createNormalizedType({ name: "TextIter" }),
        });

        const structure = writer.buildStaticFunctionStructure(func, {
            className: "TextIter",
            originalClassName: "TextIter",
            sharedLibrary: "libgtk-4.so.1",
            namespace: "Gtk",
        });

        expect(structure.returnType).toBe("TextIter");
    });
});

describe("MethodBodyWriter - extended coverage / buildClassStructStaticStructure", () => {
    it("builds a class-struct static method with the widget class parameter", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "install_property",
            cIdentifier: "gtk_widget_class_install_property",
            returnType: createNormalizedType({ name: "none" }),
            parameters: [
                createNormalizedParameter({ name: "property_id", type: createNormalizedType({ name: "guint" }) }),
            ],
        });

        const structure = writer.buildClassStructStaticStructure(method, {
            sharedLibrary: "libgtk-4.so.1",
            namespace: "Gtk",
        });

        expect(structure.isStatic).toBe(true);
        expect(structure.parameters[0]?.name).toBe("widgetClass");
        expect(structure.parameters[0]?.type).toBe("ClassStructTarget");
        expect(structure.parameters[1]?.name).toBe("propertyId");

        const w = new Writer();
        structure.statements(w);
        expect(w.toString()).toContain("resolveClassStructPointer(widgetClass)");
    });
});

describe("MethodBodyWriter - extended coverage / buildStubStructure", () => {
    it("emits a throwing stub body", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const structure = writer.buildStubStructure({
            memberName: "doThing",
            qualifiedName: "Gtk.Widget.doThing",
            doc: "Does a thing.",
            namespace: "Gtk",
            isStatic: false,
            parameters: [createNormalizedParameter({ name: "label", type: createNormalizedType({ name: "utf8" }) })],
        });

        expect(structure.name).toBe("doThing");
        expect(structure.parameters).toHaveLength(1);
        expect(structure.returnType).toBeUndefined();

        const w = new Writer();
        structure.statements(w);
        expect(w.toString()).toContain("throwUnsupported");
        expect(w.toString()).toContain("Gtk.Widget.doThing is not callable");
    });

    it("marks static stubs as static", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const structure = writer.buildStubStructure({
            memberName: "doThing",
            qualifiedName: "Gtk.doThing",
            doc: undefined,
            namespace: "Gtk",
            isStatic: true,
        });

        expect(structure.isStatic).toBe(true);
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - out parameters and tuple returns (1)", () => {
    it("returns a tuple when a method has a return value and an out parameter", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "get_size",
            cIdentifier: "gtk_widget_get_size",
            returnType: createNormalizedType({ name: "gboolean" }),
            parameters: [
                createNormalizedParameter({
                    name: "width",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("createRef");
        expect(output).toContain("return [");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - out parameters and tuple returns (2)", () => {
    it("returns the single out value for a void method with one out parameter", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "get_value",
            cIdentifier: "gtk_widget_get_value",
            returnType: createNormalizedType({ name: "none" }),
            parameters: [
                createNormalizedParameter({
                    name: "value",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("createRef");
        expect(output).toContain(".value");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - out parameters and tuple returns (3)", () => {
    it("handles a throwing method with an out parameter", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "try_get",
            cIdentifier: "gtk_widget_try_get",
            returnType: createNormalizedType({ name: "gboolean" }),
            throws: true,
            parameters: [
                createNormalizedParameter({
                    name: "value",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("const error = createRef(null)");
        expect(output).toContain("checkError");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - out parameters and tuple returns (4)", () => {
    it("wraps an out GObject parameter as a ref-handle", () => {
        const widgetClass = createNormalizedClass({ name: "Widget", glibTypeName: "GtkWidget" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            classes: new Map([["Widget", widgetClass]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "get_child",
            cIdentifier: "gtk_widget_get_child",
            returnType: createNormalizedType({ name: "none" }),
            parameters: [
                createNormalizedParameter({
                    name: "child",
                    type: createNormalizedType({ name: "Widget" }),
                    direction: "out",
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("getNativeObject");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - return wrapping variants (1)", () => {
    it("wraps boxed return values with the target class", () => {
        const rectangle = createNormalizedRecord({
            name: "Rectangle",
            qualifiedName: qualifiedName("Gdk", "Rectangle"),
            glibTypeName: "GdkRectangle",
            glibGetType: "gdk_rectangle_get_type",
        });
        const gdkNs = createNormalizedNamespace({
            name: "Gdk",
            sharedLibrary: "libgtk-4.so.1",
            records: new Map([["Rectangle", rectangle]]),
        });
        const gtkNs = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(
            new Map([
                ["Gdk", gdkNs],
                ["Gtk", gtkNs],
            ]),
        );
        const method = createNormalizedMethod({
            name: "get_allocation",
            cIdentifier: "gtk_widget_get_allocation",
            returnType: createNormalizedType({ name: "Gdk.Rectangle" }),
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        expect(w.toString()).toContain("getNativeObject");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - return wrapping variants (2)", () => {
    it("wraps interface return values via getNativeObjectAsInterface", () => {
        const orientable = createNormalizedInterface({ name: "Orientable" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            interfaces: new Map([["Orientable", orientable]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "get_orientable",
            cIdentifier: "gtk_widget_get_orientable",
            returnType: createNormalizedType({ name: "Orientable" }),
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        expect(w.toString()).toContain("getNativeObjectAsInterface");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - return wrapping variants (3)", () => {
    it("maps array-of-gobject return values over getNativeObject", () => {
        const widgetClass = createNormalizedClass({ name: "Widget", glibTypeName: "GtkWidget" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            classes: new Map([["Widget", widgetClass]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "get_children",
            cIdentifier: "gtk_widget_get_children",
            returnType: createNormalizedType({
                name: "Widget",
                isArray: true,
                elementType: createNormalizedType({ name: "Widget" }),
            }),
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain(".map(");
        expect(output).toContain("getNativeObject");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - return wrapping variants (4)", () => {
    it("wraps hashtable return values in a Map", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "get_props",
            cIdentifier: "gtk_widget_get_props",
            returnType: createNormalizedType({
                name: qualifiedName("GLib", "HashTable"),
                containerType: "ghashtable",
                typeParameters: [createNormalizedType({ name: "utf8" }), createNormalizedType({ name: "utf8" })],
            }),
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        expect(w.toString()).toContain("new Map(");
    });
});

describe("MethodBodyWriter - extended coverage / writeFunctionBody - own class returns", () => {
    it("wraps an own-class return value", () => {
        const textIter = createNormalizedRecord({
            name: "TextIter",
            qualifiedName: qualifiedName("Gtk", "TextIter"),
            glibTypeName: "GtkTextIter",
            glibGetType: "gtk_text_iter_get_type",
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([["TextIter", textIter]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const func = createNormalizedFunction({
            name: "copy",
            cIdentifier: "gtk_text_iter_copy",
            returnType: createNormalizedType({ name: "TextIter" }),
        });
        const shape = writer.buildShape(func.parameters, func.returnType, 0);

        const w = new Writer();
        writer.writeFunctionBody(func, shape, {
            sharedLibrary: "libgtk-4.so.1",
            className: "TextIter",
            returnsOwnClass: true,
        })(w);

        expect(w.toString()).toContain("getNativeObject");
    });
});

function createAsyncSetup() {
    const asyncCallback = createNormalizedCallback({
        name: "AsyncReadyCallback",
        qualifiedName: qualifiedName("Gio", "AsyncReadyCallback"),
        parameters: [
            createNormalizedParameter({
                name: "source_object",
                type: createNormalizedType({ name: "GObject.Object" }),
            }),
            createNormalizedParameter({ name: "res", type: createNormalizedType({ name: "Gio.AsyncResult" }) }),
            createNormalizedParameter({ name: "user_data", type: createNormalizedType({ name: "gpointer" }) }),
        ],
    });
    const gioNs = createNormalizedNamespace({
        name: "Gio",
        callbacks: new Map([["AsyncReadyCallback", asyncCallback]]),
    });
    const gtkNs = createNormalizedNamespace({ name: "Gtk" });
    const repo = createMockRepository(
        new Map([
            ["Gio", gioNs],
            ["Gtk", gtkNs],
        ]),
    );
    const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "Gtk");
    const imports = fileBuilder();
    const ffiTypeWriter = new FfiTypeWriter({
        currentSharedLibrary: "libgtk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
    });
    const descriptors = new FfiDescriptorRegistry();
    const writer = new MethodBodyWriter(mapper, imports, ffiTypeWriter, descriptors);
    return { repo, mapper, imports, ffiTypeWriter, writer };
}

const buildLoadAsyncCallable = (callbackParam: ReturnType<typeof createNormalizedParameter>) =>
    createNormalizedMethod({
        name: "load_async",
        cIdentifier: "gtk_thing_load_async",
        returnType: createNormalizedType({ name: "none" }),
        parameters: [
            createNormalizedParameter({
                name: "cancellable",
                type: createNormalizedType({ name: "Gio.Cancellable" }),
                nullable: true,
            }),
            callbackParam,
            createNormalizedParameter({
                name: "user_data",
                type: createNormalizedType({ name: "gpointer" }),
            }),
        ],
    });

const buildLoadFinishCallable = () =>
    createNormalizedMethod({
        name: "load_finish",
        cIdentifier: "gtk_thing_load_finish",
        returnType: createNormalizedType({ name: "gboolean" }),
        throws: true,
        parameters: [
            createNormalizedParameter({
                name: "res",
                type: createNormalizedType({ name: "Gio.AsyncResult" }),
            }),
        ],
    });

describe("MethodBodyWriter - extended coverage / buildAsyncCallableStructure (1)", () => {
    it("builds a Promise-returning wrapper for a GIO async pair", () => {
        const { writer } = createAsyncSetup();
        const callbackParam = createNormalizedParameter({
            name: "callback",
            type: createNormalizedType({ name: "Gio.AsyncReadyCallback" }),
            scope: "async",
            closure: 1,
        });
        const asyncCallable = buildLoadAsyncCallable(callbackParam);
        const finishCallable = buildLoadFinishCallable();

        const structure = writer.buildAsyncCallableStructure({
            asyncCallable,
            finishCallable,
            callbackParameter: callbackParam,
            memberName: "loadAsync",
            finishMemberName: "loadFinish",
            isStatic: false,
            sharedLibrary: "libgtk-4.so.1",
            namespace: "Gtk",
            self: { type: { type: "gobject", ownership: "borrowed" }, value: "getHandle(this)" },
        });

        expect(structure.name).toBe("loadAsync");
        expect(structure.returnType).toBe("Promise<boolean>");

        const w = new Writer();
        structure.statements(w);
        const output = w.toString();
        expect(output).toContain("promisify");
        expect(output).toContain("this.loadFinish.bind(this)");
    });
});

describe("MethodBodyWriter - extended coverage / buildAsyncCallableStructure (2)", () => {
    it("builds a static async wrapper without a self argument", () => {
        const { writer } = createAsyncSetup();
        const callbackParam = createNormalizedParameter({
            name: "callback",
            type: createNormalizedType({ name: "Gio.AsyncReadyCallback" }),
            scope: "async",
            closure: 1,
        });
        const asyncCallable = createNormalizedFunction({
            name: "fetch_async",
            cIdentifier: "gtk_fetch_async",
            returnType: createNormalizedType({ name: "none" }),
            parameters: [
                createNormalizedParameter({
                    name: "cancellable",
                    type: createNormalizedType({ name: "Gio.Cancellable" }),
                    nullable: true,
                }),
                callbackParam,
                createNormalizedParameter({
                    name: "user_data",
                    type: createNormalizedType({ name: "gpointer" }),
                }),
            ],
        });
        const finishCallable = createNormalizedFunction({
            name: "fetch_finish",
            cIdentifier: "gtk_fetch_finish",
            returnType: createNormalizedType({ name: "utf8" }),
            throws: true,
            parameters: [
                createNormalizedParameter({
                    name: "res",
                    type: createNormalizedType({ name: "Gio.AsyncResult" }),
                }),
            ],
        });

        const structure = writer.buildAsyncCallableStructure({
            asyncCallable,
            finishCallable,
            callbackParameter: callbackParam,
            memberName: "fetchAsync",
            finishMemberName: "fetchFinish",
            isStatic: true,
            sharedLibrary: "libgtk-4.so.1",
            namespace: "Gtk",
        });

        expect(structure.isStatic).toBe(true);
        expect(structure.returnType).toBe("Promise<string>");

        const w = new Writer();
        structure.statements(w);
        expect(w.toString()).toContain("promisify");
    });
});

describe("MethodBodyWriter - extended coverage / writeHiddenOutDeclarationFor (1)", () => {
    it("emits a createRef declaration for a ref-primitive hidden out", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const w = new Writer();
        writer.writeHiddenOutDeclarationFor(w, {
            varName: "outValue",
            initialValue: "0",
            tsType: "number",
            ffi: { type: "int32" },
            isLengthParam: false,
            kind: "ref-primitive",
            nullable: false,
        });

        expect(w.toString()).toContain("const outValue = createRef(0);");
    });

    it("emits a factory call for a factory-struct hidden out", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const w = new Writer();
        writer.writeHiddenOutDeclarationFor(w, {
            varName: "iter",
            initialValue: "",
            tsType: "TextIter",
            ffi: { type: "uint64" },
            isLengthParam: false,
            kind: "factory-struct",
            nullable: false,
            factoryCIdentifier: "gtkTextIterNew",
        });

        expect(w.toString()).toContain("const iter = gtkTextIterNew();");
    });
});

describe("MethodBodyWriter - extended coverage / writeHiddenOutDeclarationFor (2)", () => {
    it("emits a new-class declaration for an alloc-struct with a wrap class", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const w = new Writer();
        writer.writeHiddenOutDeclarationFor(w, {
            varName: "iter",
            initialValue: "",
            tsType: "TextIter",
            ffi: { type: "uint64" },
            isLengthParam: false,
            kind: "alloc-struct",
            nullable: false,
            wrapClassName: "TextIter",
        });

        expect(w.toString()).toContain("const iter = new TextIter();");
    });

    it("emits a createRef declaration for an alloc-struct without a wrap class", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const w = new Writer();
        writer.writeHiddenOutDeclarationFor(w, {
            varName: "slot",
            initialValue: "",
            tsType: "unknown",
            ffi: { type: "uint64" },
            isLengthParam: false,
            kind: "alloc-struct",
            nullable: false,
        });

        expect(w.toString()).toContain("const slot = createRef(null);");
    });
});

describe("MethodBodyWriter - extended coverage / writeHiddenOutDeclarationFor (3)", () => {
    it("emits a createRef(null) declaration for a ref-handle hidden out", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const w = new Writer();
        writer.writeHiddenOutDeclarationFor(w, {
            varName: "handle",
            initialValue: "null",
            tsType: "unknown",
            ffi: { type: "uint64" },
            isLengthParam: false,
            kind: "ref-handle",
            nullable: false,
        });

        expect(w.toString()).toContain("const handle = createRef(null);");
    });
});

describe("MethodBodyWriter - extended coverage / setupGErrorImports", () => {
    it("imports the local Error for the GLib namespace", () => {
        const ns = createNormalizedNamespace({ name: "GLib" });
        const repo = createMockRepository(new Map([["GLib", ns]]));
        const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "GLib");
        const imports = fileBuilder();
        const writer = new MethodBodyWriter(mapper, imports);

        expect(writer.setupGErrorImports()).toBe("Error");
    });

    it("imports the GLib namespace for non-GLib namespaces", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        expect(writer.setupGErrorImports()).toBe("GLib.Error");
    });

    it("respects an explicitly provided namespace", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        expect(writer.setupGErrorImports("GLib")).toBe("Error");
    });
});

describe("MethodBodyWriter - extended coverage / writeCallbackWrapperDeclarations", () => {
    it("emits nothing when no argument carries a callback wrapper", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const w = new Writer();
        writer.writeCallbackWrapperDeclarations(w, [{ type: { type: "int32" }, value: "count" }]);

        expect(w.toString()).toBe("");
    });

    it("emits a const declaration for an argument that carries a callback wrapper", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const w = new Writer();
        writer.writeCallbackWrapperDeclarations(w, [
            {
                type: { type: "int32" },
                value: "wrappedCb",
                callbackWrapper: {
                    paramName: "cb",
                    wrappedName: "wrappedCb",
                    wrapExpression: (writer) => writer.write("(x) => cb(x)"),
                    isOptional: false,
                },
            },
        ]);

        const output = w.toString();
        expect(output).toContain("const wrappedCb = ");
        expect(output).toContain("(x) => cb(x)");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - callback wrapper generation", () => {
    it("wraps a callback parameter whose callback receives a GObject", () => {
        const widgetClass = createNormalizedClass({ name: "Widget", glibTypeName: "GtkWidget" });
        const tickCallback = createNormalizedCallback({
            name: "TickCallback",
            qualifiedName: qualifiedName("Gtk", "TickCallback"),
            parameters: [
                createNormalizedParameter({ name: "widget", type: createNormalizedType({ name: "Widget" }) }),
                createNormalizedParameter({ name: "user_data", type: createNormalizedType({ name: "gpointer" }) }),
            ],
            returnType: createNormalizedType({ name: "gboolean" }),
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            classes: new Map([["Widget", widgetClass]]),
            callbacks: new Map([["TickCallback", tickCallback]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "add_tick_callback",
            cIdentifier: "gtk_widget_add_tick_callback",
            returnType: createNormalizedType({ name: "guint" }),
            parameters: [
                createNormalizedParameter({
                    name: "callback",
                    type: createNormalizedType({ name: "TickCallback" }),
                    scope: "notified",
                }),
                createNormalizedParameter({
                    name: "user_data",
                    type: createNormalizedType({ name: "gpointer" }),
                    closure: 0,
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("getNativeObject");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - tuple body with wrapped returns (1)", () => {
    it("wraps an interface return alongside an out parameter", () => {
        const orientable = createNormalizedInterface({ name: "Orientable" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            interfaces: new Map([["Orientable", orientable]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "resolve",
            cIdentifier: "gtk_widget_resolve",
            returnType: createNormalizedType({ name: "Orientable" }),
            parameters: [
                createNormalizedParameter({
                    name: "score",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("getNativeObjectAsInterface");
        expect(output).toContain("return [");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - tuple body with wrapped returns (2)", () => {
    it("maps an array-of-gobject return alongside an out parameter", () => {
        const widgetClass = createNormalizedClass({ name: "Widget", glibTypeName: "GtkWidget" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            classes: new Map([["Widget", widgetClass]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "list_children",
            cIdentifier: "gtk_widget_list_children",
            returnType: createNormalizedType({
                name: "Widget",
                isArray: true,
                elementType: createNormalizedType({ name: "Widget" }),
            }),
            parameters: [
                createNormalizedParameter({
                    name: "count",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain(".map(");
        expect(output).toContain("return [");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - tuple body with wrapped returns (3)", () => {
    it("wraps a hashtable return alongside an out parameter", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "collect_props",
            cIdentifier: "gtk_widget_collect_props",
            returnType: createNormalizedType({
                name: qualifiedName("GLib", "HashTable"),
                containerType: "ghashtable",
                typeParameters: [createNormalizedType({ name: "utf8" }), createNormalizedType({ name: "utf8" })],
            }),
            parameters: [
                createNormalizedParameter({
                    name: "count",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("new Map(");
        expect(output).toContain("return [");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - tuple body with wrapped returns (4)", () => {
    it("handles a nullable wrapped return value alongside an out parameter", () => {
        const widgetClass = createNormalizedClass({ name: "Widget", glibTypeName: "GtkWidget" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            classes: new Map([["Widget", widgetClass]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "find_child",
            cIdentifier: "gtk_widget_find_child",
            returnType: createNormalizedType({ name: "Widget", nullable: true }),
            parameters: [
                createNormalizedParameter({
                    name: "index",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("=== null ? null");
        expect(output).toContain("return [");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - array of interfaces (1)", () => {
    it("maps an array-of-interface return over getNativeObjectAsInterface", () => {
        const orientable = createNormalizedInterface({ name: "Orientable" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            interfaces: new Map([["Orientable", orientable]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "list_orientables",
            cIdentifier: "gtk_widget_list_orientables",
            returnType: createNormalizedType({
                name: "Orientable",
                isArray: true,
                elementType: createNormalizedType({ name: "Orientable" }),
            }),
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        expect(w.toString()).toContain("getNativeObjectAsInterface");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - array of interfaces (2)", () => {
    it("maps an array-of-interface return alongside an out parameter", () => {
        const orientable = createNormalizedInterface({ name: "Orientable" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            interfaces: new Map([["Orientable", orientable]]),
        });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "collect_orientables",
            cIdentifier: "gtk_widget_collect_orientables",
            returnType: createNormalizedType({
                name: "Orientable",
                isArray: true,
                elementType: createNormalizedType({ name: "Orientable" }),
            }),
            parameters: [
                createNormalizedParameter({
                    name: "count",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("getNativeObjectAsInterface");
        expect(output).toContain("return [");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - nullable out parameters", () => {
    it("coalesces a nullable out parameter to null in the returned tuple", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "peek_value",
            cIdentifier: "gtk_widget_peek_value",
            returnType: createNormalizedType({ name: "gboolean" }),
            parameters: [
                createNormalizedParameter({
                    name: "out_text",
                    type: createNormalizedType({ name: "utf8", nullable: true }),
                    direction: "out",
                    nullable: true,
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        expect(w.toString()).toContain("return [");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - result name collision", () => {
    it("renames the result variable when a parameter is named result", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));
        const method = createNormalizedMethod({
            name: "compute",
            cIdentifier: "gtk_widget_compute",
            returnType: createNormalizedType({ name: "gboolean" }),
            parameters: [
                createNormalizedParameter({ name: "result", type: createNormalizedType({ name: "gint" }) }),
                createNormalizedParameter({
                    name: "extra",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        const output = w.toString();
        expect(output).toContain("return [");
    });
});

describe("MethodBodyWriter - extended coverage / writeMethodBody - inout boxed parameter", () => {
    it("passes an inout boxed parameter through and rewraps it", () => {
        const rectangle = createNormalizedRecord({
            name: "Rectangle",
            qualifiedName: qualifiedName("Gdk", "Rectangle"),
            glibTypeName: "GdkRectangle",
            glibGetType: "gdk_rectangle_get_type",
        });
        const gdkNs = createNormalizedNamespace({
            name: "Gdk",
            sharedLibrary: "libgtk-4.so.1",
            records: new Map([["Rectangle", rectangle]]),
        });
        const gtkNs = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(
            new Map([
                ["Gdk", gdkNs],
                ["Gtk", gtkNs],
            ]),
        );
        const method = createNormalizedMethod({
            name: "intersect",
            cIdentifier: "gtk_widget_intersect",
            returnType: createNormalizedType({ name: "gboolean" }),
            parameters: [
                createNormalizedParameter({
                    name: "area",
                    type: createNormalizedType({ name: "Gdk.Rectangle" }),
                    direction: "inout",
                }),
            ],
        });
        const shape = writer.buildShape(method.parameters, method.returnType, 1);

        const w = new Writer();
        writer.writeMethodBody(method, shape, {
            sharedLibrary: "libgtk-4.so.1",
            selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
        })(w);

        expect(w.toString()).toContain("return [");
    });
});

describe("MethodBodyWriter - extended coverage / writeFactoryMethodBody - hidden outs", () => {
    it("declares hidden outs before the factory call", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { writer } = createTestSetup(new Map([["Gtk", ns]]));

        const w = new Writer();
        writer.writeFactoryMethodBody({
            sharedLibrary: "libgtk-4.so.1",
            cIdentifier: "gtk_widget_new_with_out",
            args: [],
            returnTypeDescriptor: { type: "gobject", ownership: "full" },
            wrapClassName: "Widget",
            throws: false,
            useClassInWrap: false,
            hiddenOuts: [
                {
                    varName: "outValue",
                    initialValue: "0",
                    tsType: "number",
                    ffi: { type: "int32" },
                    isLengthParam: false,
                    kind: "ref-primitive",
                    nullable: false,
                },
            ],
        })(w);

        const output = w.toString();
        expect(output).toContain("const outValue = createRef(0);");
        expect(output).toContain("const ptr = call(");
    });
});
