import { describe, expect, it } from "vitest";
import { fileBuilder } from "../../../../src/builders/file-builder.js";
import { Writer } from "../../../../src/builders/writer.js";
import { FfiMapper } from "../../../../src/core/type-system/ffi-mapper.js";
import { SELF_TYPE_GOBJECT } from "../../../../src/core/type-system/ffi-types.js";
import { MethodBuilder } from "../../../../src/ffi/generators/class/method-builder.js";
import {
    createNormalizedMethod,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedType,
} from "../../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../../fixtures/mock-repository.js";

function createTestSetup(namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map()) {
    const ns = createNormalizedNamespace({ name: "Gtk" });
    namespaces.set("Gtk", ns);
    const repo = createMockRepository(namespaces);
    const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
    const file = fileBuilder();
    const methodRenames = new Map<string, string>();
    const options = {
        namespace: "Gtk",
        sharedLibrary: "libgtk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
        gobjectLibrary: "libgobject-2.0.so.0",
    };

    const builder = new MethodBuilder(ffiMapper, file, methodRenames, options);
    return { builder, ffiMapper, methodRenames };
}

describe("MethodBuilder", () => {
    describe("constructor", () => {
        it("creates builder with dependencies", () => {
            const { builder } = createTestSetup();
            expect(builder).toBeInstanceOf(MethodBuilder);
        });
    });

    describe("buildStructures", () => {
        it("returns empty array when no methods", () => {
            const { builder } = createTestSetup();

            const structures = builder.buildStructures([], SELF_TYPE_GOBJECT);

            expect(structures).toHaveLength(0);
        });

        it("builds structure for single method", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "get_label",
                    cIdentifier: "gtk_button_get_label",
                    returnType: createNormalizedType({ name: "utf8" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            expect(structures).toHaveLength(1);
            expect(structures[0].name).toBe("getLabel");
        });

        it("builds structures for multiple methods", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "get_label",
                    cIdentifier: "gtk_button_get_label",
                    returnType: createNormalizedType({ name: "utf8" }),
                }),
                createNormalizedMethod({
                    name: "set_label",
                    cIdentifier: "gtk_button_set_label",
                    returnType: createNormalizedType({ name: "none" }),
                    parameters: [
                        createNormalizedParameter({
                            name: "label",
                            type: createNormalizedType({ name: "utf8" }),
                        }),
                    ],
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            expect(structures).toHaveLength(2);
            expect(structures[0].name).toBe("getLabel");
            expect(structures[1].name).toBe("setLabel");
        });

        it("converts method names to camelCase", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "get_some_long_property",
                    cIdentifier: "gtk_button_get_some_long_property",
                    returnType: createNormalizedType({ name: "gint" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            expect(structures[0].name).toBe("getSomeLongProperty");
        });

        it("includes parameters in method structure", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "set_values",
                    cIdentifier: "gtk_button_set_values",
                    returnType: createNormalizedType({ name: "none" }),
                    parameters: [
                        createNormalizedParameter({
                            name: "x",
                            type: createNormalizedType({ name: "gint" }),
                        }),
                        createNormalizedParameter({
                            name: "y",
                            type: createNormalizedType({ name: "gint" }),
                        }),
                    ],
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            expect(structures[0].parameters).toHaveLength(2);
        });

        it("includes return type for non-void methods", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "get_count",
                    cIdentifier: "gtk_button_get_count",
                    returnType: createNormalizedType({ name: "gint" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            expect(structures[0].returnType).toBe("number");
        });

        it("omits return type for void methods", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "do_something",
                    cIdentifier: "gtk_button_do_something",
                    returnType: createNormalizedType({ name: "none" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            expect(structures[0].returnType).toBeUndefined();
        });
    });

    describe("method filtering", () => {
        it("filters out duplicate methods with same cIdentifier", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "get_value",
                    cIdentifier: "gtk_button_get_value",
                    returnType: createNormalizedType({ name: "gint" }),
                }),
                createNormalizedMethod({
                    name: "get_value",
                    cIdentifier: "gtk_button_get_value",
                    returnType: createNormalizedType({ name: "gint" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            expect(structures).toHaveLength(1);
        });

        it("filters out methods whose parameters are GLib.Closure (untyped, unsafe)", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "with_closure",
                    cIdentifier: "gtk_button_with_closure",
                    returnType: createNormalizedType({ name: "none" }),
                    parameters: [
                        createNormalizedParameter({
                            name: "callback",
                            type: createNormalizedType({ name: "GLib.Closure" }),
                        }),
                    ],
                }),
                createNormalizedMethod({
                    name: "normal",
                    cIdentifier: "gtk_button_normal",
                    returnType: createNormalizedType({ name: "none" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            expect(structures).toHaveLength(1);
            expect(structures[0].name).toBe("normal");
        });
    });

    describe("async method handling", () => {
        it("replaces async/finish pair with wrapper and keeps regular methods", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "load_async",
                    cIdentifier: "gtk_button_load_async",
                    returnType: createNormalizedType({ name: "none" }),
                    finishFunc: "load_finish",
                }),
                createNormalizedMethod({
                    name: "load_finish",
                    cIdentifier: "gtk_button_load_finish",
                    returnType: createNormalizedType({ name: "utf8" }),
                }),
                createNormalizedMethod({
                    name: "get_label",
                    cIdentifier: "gtk_button_get_label",
                    returnType: createNormalizedType({ name: "utf8" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            const names = structures.map((s) => s.name);
            expect(names).toContain("loadAsync");
            expect(names).not.toContain("loadFinish");
            expect(names).toContain("getLabel");
        });

        it("creates async wrapper method for async pair", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "load_async",
                    cIdentifier: "gtk_button_load_async",
                    returnType: createNormalizedType({ name: "none" }),
                    finishFunc: "load_finish",
                }),
                createNormalizedMethod({
                    name: "load_finish",
                    cIdentifier: "gtk_button_load_finish",
                    returnType: createNormalizedType({ name: "utf8" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            expect(structures.some((s) => s.name === "loadAsync")).toBe(true);
        });

        it("async wrapper returns Promise", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "save_async",
                    cIdentifier: "gtk_button_save_async",
                    returnType: createNormalizedType({ name: "none" }),
                    finishFunc: "save_finish",
                }),
                createNormalizedMethod({
                    name: "save_finish",
                    cIdentifier: "gtk_button_save_finish",
                    returnType: createNormalizedType({ name: "gboolean" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            const asyncMethod = structures.find((s) => s.name === "saveAsync");
            expect(asyncMethod?.returnType).toContain("Promise");
        });
    });

    describe("hasUnsupportedCallbacks", () => {
        it("returns false when no callbacks", () => {
            const { builder } = createTestSetup();
            const parameters = [
                createNormalizedParameter({
                    name: "value",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ];

            const result = builder.hasUnsupportedCallbacks(parameters);

            expect(result).toBe(false);
        });

        it("returns true for GLib.Closure (untyped variadic, unsafe)", () => {
            const { builder } = createTestSetup();
            const parameters = [
                createNormalizedParameter({
                    name: "callback",
                    type: createNormalizedType({ name: "GLib.Closure" }),
                }),
            ];

            const result = builder.hasUnsupportedCallbacks(parameters);

            expect(result).toBe(true);
        });

        it("returns true for raw pointer parameters (gpointer)", () => {
            const { builder } = createTestSetup();
            const parameters = [
                createNormalizedParameter({
                    name: "data",
                    type: createNormalizedType({ name: "gpointer" }),
                }),
            ];

            const result = builder.hasUnsupportedCallbacks(parameters);

            expect(result).toBe(true);
        });
    });

    describe("isParamSpec handling", () => {
        it("uses GObject self type for regular classes", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "get_value",
                    cIdentifier: "gtk_button_get_value",
                    returnType: createNormalizedType({ name: "gint" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            expect(structures).toHaveLength(1);
        });

        it("uses GParam self type for ParamSpec classes", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "get_value",
                    cIdentifier: "g_param_spec_get_value",
                    returnType: createNormalizedType({ name: "gint" }),
                }),
            ];

            const structures = builder.buildStructures(methods, { type: "gparam", ownership: "borrowed" });

            expect(structures).toHaveLength(1);
        });
    });

    describe("method renames", () => {
        it("uses dynamic rename from context when available", () => {
            const { builder, methodRenames } = createTestSetup();
            methodRenames.set("gtk_button_get_name", "getBuildableName");
            const methods = [
                createNormalizedMethod({
                    name: "get_name",
                    cIdentifier: "gtk_button_get_name",
                    returnType: createNormalizedType({ name: "utf8" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);

            expect(structures[0].name).toBe("getBuildableName");
        });
    });

    describe("async wrapper body emission", () => {
        const buildAsyncStructure = (asyncReturnType = "none", finishReturnType = "utf8", finishThrows = false) => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "load_async",
                    cIdentifier: "gtk_button_load_async",
                    returnType: createNormalizedType({ name: asyncReturnType }),
                    finishFunc: "load_finish",
                }),
                createNormalizedMethod({
                    name: "load_finish",
                    cIdentifier: "gtk_button_load_finish",
                    returnType: createNormalizedType({ name: finishReturnType }),
                    throws: finishThrows,
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);
            const asyncStructure = structures.find((s) => s.name === "loadAsync");
            if (!asyncStructure) throw new Error("loadAsync structure not produced");
            return asyncStructure;
        };

        const renderStatements = (structure: { statements: unknown }): string => {
            const writer = new Writer();
            (structure.statements as (w: Writer) => void)(writer);
            return writer.toString();
        };

        it("emits a Promise body that calls the async C function", () => {
            const out = renderStatements(buildAsyncStructure());
            expect(out).toContain("return new Promise(");
            expect(out).toContain('"libgtk-4.so.1"');
            expect(out).toContain('"gtk_button_load_async"');
        });

        it("invokes the finish C function inside the async callback", () => {
            const out = renderStatements(buildAsyncStructure());
            expect(out).toContain('"gtk_button_load_finish"');
        });

        it("uses _reject when the finish method does not throw", () => {
            const out = renderStatements(buildAsyncStructure("none", "utf8", false));
            expect(out).toContain("(resolve, _reject) =>");
        });

        it("uses reject and emits the GError check when the finish method throws", () => {
            const out = renderStatements(buildAsyncStructure("none", "utf8", true));
            expect(out).toContain("(resolve, reject) =>");
            expect(out).toContain("error.value !== null");
            expect(out).toContain("reject(new NativeError(");
        });

        it("resolves with the unwrapped value when the finish return is a primitive", () => {
            const out = renderStatements(buildAsyncStructure("none", "gint"));
            expect(out).toContain("resolve(value);");
        });

        it("resolves with no argument when the finish return is void", () => {
            const out = renderStatements(buildAsyncStructure("none", "none"));
            expect(out).toContain("resolve();");
            expect(out).not.toContain("resolve(value)");
            expect(out).not.toContain("resolve(getNativeObject");
        });
    });

    describe("async parameter filtering", () => {
        it("drops user_data parameters from the async wrapper signature", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "load_async",
                    cIdentifier: "gtk_button_load_async",
                    returnType: createNormalizedType({ name: "none" }),
                    finishFunc: "load_finish",
                    parameters: [
                        createNormalizedParameter({
                            name: "user_data",
                            type: createNormalizedType({ name: "gpointer" }),
                        }),
                        createNormalizedParameter({
                            name: "label",
                            type: createNormalizedType({ name: "utf8" }),
                        }),
                    ],
                }),
                createNormalizedMethod({
                    name: "load_finish",
                    cIdentifier: "gtk_button_load_finish",
                    returnType: createNormalizedType({ name: "none" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);
            const asyncStructure = structures.find((s) => s.name === "loadAsync");
            const paramNames = asyncStructure?.parameters?.map((p: { name: string }) => p.name) ?? [];

            expect(paramNames).not.toContain("user_data");
            expect(paramNames).toContain("label");
        });

        it("drops vararg slots from the async wrapper signature", () => {
            const { builder } = createTestSetup();
            const methods = [
                createNormalizedMethod({
                    name: "load_async",
                    cIdentifier: "gtk_button_load_async",
                    returnType: createNormalizedType({ name: "none" }),
                    finishFunc: "load_finish",
                    parameters: [
                        createNormalizedParameter({
                            name: "...",
                            type: createNormalizedType({ name: "gpointer" }),
                        }),
                    ],
                }),
                createNormalizedMethod({
                    name: "load_finish",
                    cIdentifier: "gtk_button_load_finish",
                    returnType: createNormalizedType({ name: "none" }),
                }),
            ];

            const structures = builder.buildStructures(methods, SELF_TYPE_GOBJECT);
            const asyncStructure = structures.find((s) => s.name === "loadAsync");

            expect(asyncStructure?.parameters?.length ?? 0).toBe(0);
        });
    });
});
