import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../../../src/core/generation-context.js";
import { FfiMapper } from "../../../../src/core/type-system/ffi-mapper.js";
import { createWriters } from "../../../../src/core/writers/index.js";
import { StaticFunctionBuilder } from "../../../../src/ffi/generators/class/static-function-builder.js";
import {
    createNormalizedClass,
    createNormalizedFunction,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedType,
    qualifiedName,
} from "../../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../../fixtures/mock-repository.js";

function createTestSetup(
    classOverrides: Partial<Parameters<typeof createNormalizedClass>[0]> = {},
    namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map(),
) {
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

    const cls = createNormalizedClass({
        name: "Button",
        qualifiedName: qualifiedName("Gtk", "Button"),
        parent: null,
        staticFunctions: [],
        ...classOverrides,
    });

    const builder = new StaticFunctionBuilder(cls, ffiMapper, ctx, writers, options);
    return { cls, builder, ctx, ffiMapper };
}

describe("StaticFunctionBuilder", () => {
    describe("constructor", () => {
        it("creates builder with class and dependencies", () => {
            const { builder } = createTestSetup();
            expect(builder).toBeInstanceOf(StaticFunctionBuilder);
        });
    });

    describe("buildStructures", () => {
        it("returns empty array when no static functions", () => {
            const { builder } = createTestSetup({ staticFunctions: [] });

            const structures = builder.buildStructures();

            expect(structures).toHaveLength(0);
        });

        it("builds structure for single static function", () => {
            const { builder } = createTestSetup({
                staticFunctions: [
                    createNormalizedFunction({
                        name: "get_default",
                        cIdentifier: "gtk_button_get_default",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [],
                    }),
                ],
            });

            const structures = builder.buildStructures();

            expect(structures).toHaveLength(1);
            expect(structures[0].name).toBe("getDefault");
            expect(structures[0].isStatic).toBe(true);
        });

        it("builds structures for multiple static functions", () => {
            const { builder } = createTestSetup({
                staticFunctions: [
                    createNormalizedFunction({
                        name: "func_one",
                        cIdentifier: "gtk_button_func_one",
                        returnType: createNormalizedType({ name: "none" }),
                    }),
                    createNormalizedFunction({
                        name: "func_two",
                        cIdentifier: "gtk_button_func_two",
                        returnType: createNormalizedType({ name: "none" }),
                    }),
                ],
            });

            const structures = builder.buildStructures();

            expect(structures).toHaveLength(2);
            expect(structures[0].name).toBe("funcOne");
            expect(structures[1].name).toBe("funcTwo");
        });

        it("converts function names to camelCase", () => {
            const { builder } = createTestSetup({
                staticFunctions: [
                    createNormalizedFunction({
                        name: "some_long_function_name",
                        cIdentifier: "gtk_button_some_long_function_name",
                        returnType: createNormalizedType({ name: "none" }),
                    }),
                ],
            });

            const structures = builder.buildStructures();

            expect(structures[0].name).toBe("someLongFunctionName");
        });

        it("includes parameters in structure", () => {
            const { builder } = createTestSetup({
                staticFunctions: [
                    createNormalizedFunction({
                        name: "with_params",
                        cIdentifier: "gtk_button_with_params",
                        returnType: createNormalizedType({ name: "none" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "label",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                            createNormalizedParameter({
                                name: "count",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                        ],
                    }),
                ],
            });

            const structures = builder.buildStructures();

            expect(structures[0].parameters).toHaveLength(2);
            expect(structures[0].parameters?.[0].name).toBe("label");
            expect(structures[0].parameters?.[1].name).toBe("count");
        });

        it("includes return type when not void", () => {
            const { builder } = createTestSetup({
                staticFunctions: [
                    createNormalizedFunction({
                        name: "get_count",
                        cIdentifier: "gtk_button_get_count",
                        returnType: createNormalizedType({ name: "gint" }),
                    }),
                ],
            });

            const structures = builder.buildStructures();

            expect(structures[0].returnType).toBe("number");
        });

        it("omits return type for void functions", () => {
            const { builder } = createTestSetup({
                staticFunctions: [
                    createNormalizedFunction({
                        name: "do_something",
                        cIdentifier: "gtk_button_do_something",
                        returnType: createNormalizedType({ name: "none" }),
                    }),
                ],
            });

            const structures = builder.buildStructures();

            expect(structures[0].returnType).toBeUndefined();
        });

        it("filters out functions with unsupported callbacks", () => {
            const { builder } = createTestSetup({
                staticFunctions: [
                    createNormalizedFunction({
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
                    createNormalizedFunction({
                        name: "normal",
                        cIdentifier: "gtk_button_normal",
                        returnType: createNormalizedType({ name: "none" }),
                    }),
                ],
            });

            const structures = builder.buildStructures();

            expect(structures).toHaveLength(1);
            expect(structures[0].name).toBe("normal");
        });

        it("uses normalized class name for return type mapping", () => {
            const { builder } = createTestSetup({
                name: "Button",
                staticFunctions: [
                    createNormalizedFunction({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                    }),
                ],
            });

            const structures = builder.buildStructures();

            expect(structures[0].returnType).toBe("Button");
        });
    });

    describe("context integration", () => {
        it("creates context and writers correctly during setup", () => {
            const { builder, ctx, ffiMapper } = createTestSetup({
                staticFunctions: [
                    createNormalizedFunction({
                        name: "get_value",
                        cIdentifier: "gtk_button_get_value",
                        returnType: createNormalizedType({ name: "gint" }),
                    }),
                ],
            });

            expect(builder).toBeDefined();
            expect(ctx).toBeInstanceOf(GenerationContext);
            expect(ffiMapper).toBeInstanceOf(FfiMapper);
        });
    });
});
