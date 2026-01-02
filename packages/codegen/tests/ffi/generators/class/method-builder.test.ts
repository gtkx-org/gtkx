import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../../../src/core/generation-context.js";
import { FfiMapper } from "../../../../src/core/type-system/ffi-mapper.js";
import { createWriters } from "../../../../src/core/writers/index.js";
import { MethodBuilder } from "../../../../src/ffi/generators/class/method-builder.js";
import {
    createNormalizedConstructor,
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
    const ctx = new GenerationContext();
    const writers = createWriters({
        sharedLibrary: "libgtk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
    });
    const options = {
        namespace: "Gtk",
        sharedLibrary: "libgtk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
        gobjectLibrary: "libgobject-2.0.so.0",
    };

    const builder = new MethodBuilder(ffiMapper, ctx, writers, options);
    return { builder, ctx, ffiMapper };
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

            const structures = builder.buildStructures([], false);

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

            const structures = builder.buildStructures(methods, false);

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

            const structures = builder.buildStructures(methods, false);

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

            const structures = builder.buildStructures(methods, false);

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

            const structures = builder.buildStructures(methods, false);

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

            const structures = builder.buildStructures(methods, false);

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

            const structures = builder.buildStructures(methods, false);

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

            const structures = builder.buildStructures(methods, false);

            expect(structures).toHaveLength(1);
        });

        it("filters out methods with unsupported callbacks", () => {
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

            const structures = builder.buildStructures(methods, false);

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

            const structures = builder.buildStructures(methods, false);

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

            const structures = builder.buildStructures(methods, false);

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

            const structures = builder.buildStructures(methods, false);

            const asyncMethod = structures.find((s) => s.name === "saveAsync");
            expect(asyncMethod?.returnType).toContain("Promise");
        });
    });

    describe("hasRefParameter", () => {
        it("returns false when no ref parameters", () => {
            const { builder } = createTestSetup();
            const parameters = [
                createNormalizedParameter({
                    name: "value",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ];

            const result = builder.hasRefParameter(parameters);

            expect(result).toBe(false);
        });

        it("returns true when out parameter present", () => {
            const { builder } = createTestSetup();
            const parameters = [
                createNormalizedParameter({
                    name: "out_value",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                }),
            ];

            const result = builder.hasRefParameter(parameters);

            expect(result).toBe(true);
        });

        it("returns true when inout parameter present", () => {
            const { builder } = createTestSetup();
            const parameters = [
                createNormalizedParameter({
                    name: "inout_value",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "inout",
                }),
            ];

            const result = builder.hasRefParameter(parameters);

            expect(result).toBe(true);
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

        it("returns true for GLib.Closure", () => {
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
    });

    describe("selectConstructors", () => {
        it("returns empty when no constructors", () => {
            const { builder } = createTestSetup();

            const result = builder.selectConstructors([]);

            expect(result.supported).toHaveLength(0);
            expect(result.main).toBeUndefined();
        });

        it("selects constructor without unsupported callbacks", () => {
            const { builder } = createTestSetup();
            const constructors = [
                createNormalizedConstructor({
                    name: "new",
                    cIdentifier: "gtk_button_new",
                    returnType: createNormalizedType({ name: "Gtk.Button" }),
                    parameters: [],
                }),
            ];

            const result = builder.selectConstructors(constructors);

            expect(result.supported).toHaveLength(1);
        });

        it("identifies main constructor", () => {
            const { builder } = createTestSetup();
            const constructors = [
                createNormalizedConstructor({
                    name: "new",
                    cIdentifier: "gtk_button_new",
                    returnType: createNormalizedType({ name: "Gtk.Button" }),
                    parameters: [],
                }),
            ];

            const result = builder.selectConstructors(constructors);

            expect(result.main).toBeDefined();
            expect(result.main?.name).toBe("new");
        });

        it("filters out constructors with unsupported callbacks", () => {
            const { builder } = createTestSetup();
            const constructors = [
                createNormalizedConstructor({
                    name: "new_with_callback",
                    cIdentifier: "gtk_button_new_with_callback",
                    returnType: createNormalizedType({ name: "Gtk.Button" }),
                    parameters: [
                        createNormalizedParameter({
                            name: "callback",
                            type: createNormalizedType({ name: "GLib.Closure" }),
                        }),
                    ],
                }),
                createNormalizedConstructor({
                    name: "new",
                    cIdentifier: "gtk_button_new",
                    returnType: createNormalizedType({ name: "Gtk.Button" }),
                    parameters: [],
                }),
            ];

            const result = builder.selectConstructors(constructors);

            expect(result.supported).toHaveLength(1);
            expect(result.supported[0].name).toBe("new");
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

            const structures = builder.buildStructures(methods, false);

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

            const structures = builder.buildStructures(methods, true);

            expect(structures).toHaveLength(1);
        });
    });

    describe("method renames", () => {
        it("uses dynamic rename from context when available", () => {
            const { builder, ctx } = createTestSetup();
            ctx.methodRenames.set("gtk_button_get_name", "getBuildableName");
            const methods = [
                createNormalizedMethod({
                    name: "get_name",
                    cIdentifier: "gtk_button_get_name",
                    returnType: createNormalizedType({ name: "utf8" }),
                }),
            ];

            const structures = builder.buildStructures(methods, false);

            expect(structures[0].name).toBe("getBuildableName");
        });
    });
});
