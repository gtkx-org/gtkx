import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../../../src/core/generation-context.js";
import { FfiMapper } from "../../../../src/core/type-system/ffi-mapper.js";
import { createWriters } from "../../../../src/core/writers/index.js";
import { ConstructorBuilder } from "../../../../src/ffi/generators/class/constructor-builder.js";
import {
    createNormalizedClass,
    createNormalizedConstructor,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedType,
    qualifiedName,
} from "../../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../../fixtures/mock-repository.js";
import { createTestProject, createTestSourceFile, getGeneratedCode } from "../../../fixtures/ts-morph-helpers.js";

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
        constructors: [],
        ...classOverrides,
    });

    const project = createTestProject();
    const sourceFile = createTestSourceFile(project, "button.ts");
    const classDecl = sourceFile.addClass({ name: "Button" });

    const builder = new ConstructorBuilder(cls, ffiMapper, ctx, writers, options);
    return { cls, builder, ctx, ffiMapper, classDecl, sourceFile };
}

describe("ConstructorBuilder", () => {
    describe("constructor", () => {
        it("creates builder with class and dependencies", () => {
            const { builder } = createTestSetup();
            expect(builder).toBeInstanceOf(ConstructorBuilder);
        });
    });

    describe("addConstructorAndBuildFactoryStructures", () => {
        it("returns empty array when no constructors and no parent", () => {
            const { builder, classDecl } = createTestSetup({ constructors: [] });

            const factoryMethods = builder.addConstructorAndBuildFactoryStructures(classDecl, false);

            expect(factoryMethods).toHaveLength(1);
            expect(factoryMethods[0].name).toBe("create");
        });

        it("adds simple constructor when no parent", () => {
            const { builder, classDecl, sourceFile } = createTestSetup({ constructors: [] });

            builder.addConstructorAndBuildFactoryStructures(classDecl, false);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("super()");
            expect(code).toContain("this.create()");
        });

        it("adds super-only constructor when has parent but no constructors", () => {
            const { builder, classDecl, sourceFile } = createTestSetup({ constructors: [] });

            builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("super()");
        });

        it("builds factory methods for non-main constructors when has parent", () => {
            const { builder, classDecl } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [],
                    }),
                    createNormalizedConstructor({
                        name: "new_with_label",
                        cIdentifier: "gtk_button_new_with_label",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "label",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                    }),
                ],
            });

            const factoryMethods = builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            expect(factoryMethods.length).toBeGreaterThanOrEqual(1);
        });

        it("creates static factory method with correct name", () => {
            const { builder, classDecl } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [],
                    }),
                    createNormalizedConstructor({
                        name: "new_with_label",
                        cIdentifier: "gtk_button_new_with_label",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "label",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                    }),
                ],
            });

            const factoryMethods = builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            const withLabel = factoryMethods.find((m) => m.name === "newWithLabel");
            expect(withLabel).toBeDefined();
        });

        it("factory method is static", () => {
            const { builder, classDecl } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [],
                    }),
                    createNormalizedConstructor({
                        name: "new_with_mnemonic",
                        cIdentifier: "gtk_button_new_with_mnemonic",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "label",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                    }),
                ],
            });

            const factoryMethods = builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            const staticMethods = factoryMethods.filter((m) => m.isStatic);
            expect(staticMethods.length).toBeGreaterThan(0);
        });

        it("factory method returns class type", () => {
            const { builder, classDecl } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [],
                    }),
                    createNormalizedConstructor({
                        name: "new_from_icon",
                        cIdentifier: "gtk_button_new_from_icon",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "icon_name",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                    }),
                ],
            });

            const factoryMethods = builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            const method = factoryMethods.find((m) => m.isStatic);
            expect(method?.returnType).toBe("Button");
        });
    });

    describe("main constructor selection", () => {
        it("uses main constructor when available with parent", () => {
            const { builder, classDecl, sourceFile } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [],
                    }),
                ],
            });

            builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("constructor");
        });

        it("creates factory for non-main constructors when main exists", () => {
            const { builder, classDecl } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [],
                    }),
                    createNormalizedConstructor({
                        name: "new_with_label",
                        cIdentifier: "gtk_button_new_with_label",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "label",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                    }),
                ],
            });

            const factoryMethods = builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            expect(factoryMethods.length).toBeGreaterThan(0);
        });
    });

    describe("context updates", () => {
        it("sets usesInstantiating flag when main constructor with parent", () => {
            const { builder, classDecl, ctx } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [],
                    }),
                ],
            });

            builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            expect(ctx.usesInstantiating).toBe(true);
        });

        it("sets usesGetNativeObject flag for factory methods", () => {
            const { builder, classDecl, ctx } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [],
                    }),
                    createNormalizedConstructor({
                        name: "new_with_label",
                        cIdentifier: "gtk_button_new_with_label",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "label",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                    }),
                ],
            });

            builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            expect(ctx.usesGetNativeObject).toBe(true);
        });
    });

    describe("GObject.new fallback", () => {
        it("uses g_object_new when no main constructor but has glibGetType", () => {
            const { builder, classDecl, sourceFile } = createTestSetup({
                constructors: [],
                glibGetType: "gtk_button_get_type",
                abstract: false,
            });

            builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("constructor");
        });

        it("does not use g_object_new for abstract classes", () => {
            const { builder, classDecl, sourceFile } = createTestSetup({
                constructors: [],
                glibGetType: "gtk_button_get_type",
                abstract: true,
            });

            builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            const code = getGeneratedCode(sourceFile);
            expect(code).not.toContain("g_object_new");
        });
    });

    describe("constructor parameters", () => {
        it("includes parameters in constructor", () => {
            const { builder, classDecl, sourceFile } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new_with_label",
                        cIdentifier: "gtk_button_new_with_label",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "label",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                    }),
                ],
            });

            builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("label");
        });

        it("includes multiple parameters", () => {
            const { builder, classDecl, sourceFile } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new_with_range",
                        cIdentifier: "gtk_spin_button_new_with_range",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "min",
                                type: createNormalizedType({ name: "gdouble" }),
                            }),
                            createNormalizedParameter({
                                name: "max",
                                type: createNormalizedType({ name: "gdouble" }),
                            }),
                            createNormalizedParameter({
                                name: "step",
                                type: createNormalizedType({ name: "gdouble" }),
                            }),
                        ],
                    }),
                ],
            });

            builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("min");
            expect(code).toContain("max");
            expect(code).toContain("step");
        });
    });

    describe("ownership handling", () => {
        it("uses full ownership when transfer is full", () => {
            const { builder, classDecl } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({
                            name: "Gtk.Button",
                            transferOwnership: "full",
                        }),
                        parameters: [],
                    }),
                ],
            });

            const factoryMethods = builder.addConstructorAndBuildFactoryStructures(classDecl, true);

            expect(factoryMethods).toBeDefined();
        });
    });

    describe("protected create method", () => {
        it("creates protected create method when no parent", () => {
            const { builder, classDecl } = createTestSetup({ constructors: [] });

            const factoryMethods = builder.addConstructorAndBuildFactoryStructures(classDecl, false);

            const createMethod = factoryMethods.find((m) => m.name === "create");
            expect(createMethod).toBeDefined();
            expect(createMethod?.scope).toBeDefined();
        });
    });
});
