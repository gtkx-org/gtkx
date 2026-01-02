import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../../src/core/generation-context.js";
import { FfiMapper } from "../../../src/core/type-system/ffi-mapper.js";
import { createWriters } from "../../../src/core/writers/index.js";
import { InterfaceGenerator } from "../../../src/ffi/generators/interface.js";
import {
    createNormalizedInterface,
    createNormalizedMethod,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedType,
} from "../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../fixtures/mock-repository.js";
import { createTestProject, createTestSourceFile, getGeneratedCode } from "../../fixtures/ts-morph-helpers.js";

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
    const project = createTestProject();
    const sourceFile = createTestSourceFile(project, "interface.ts");
    const generator = new InterfaceGenerator(ffiMapper, ctx, writers, repo as Parameters<typeof FfiMapper>[0], options);
    return { generator, ctx, sourceFile, project, repo };
}

describe("InterfaceGenerator", () => {
    describe("constructor", () => {
        it("creates generator with dependencies", () => {
            const { generator } = createTestSetup();
            expect(generator).toBeInstanceOf(InterfaceGenerator);
        });
    });

    describe("generateToSourceFile", () => {
        it("returns true when generating interface", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                methods: [],
            });

            const result = generator.generateToSourceFile(iface, sourceFile);

            expect(result).toBe(true);
        });

        it("generates class with PascalCase name", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                methods: [],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export class Buildable");
        });

        it("extends NativeObject", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                methods: [],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("extends NativeObject");
        });

        it("adds glibTypeName property when present", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                glibTypeName: "GtkBuildable",
                methods: [],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("glibTypeName");
            expect(code).toContain('"GtkBuildable"');
        });

        it("adds objectType property as interface when glibTypeName present", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                glibTypeName: "GtkBuildable",
                methods: [],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("objectType");
            expect(code).toContain('"interface"');
        });

        it("generates methods for interface", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Orientable",
                methods: [
                    createNormalizedMethod({
                        name: "get_orientation",
                        cIdentifier: "gtk_orientable_get_orientation",
                        returnType: createNormalizedType({ name: "gint" }),
                    }),
                ],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("getOrientation");
        });

        it("generates multiple methods", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Orientable",
                methods: [
                    createNormalizedMethod({
                        name: "get_orientation",
                        cIdentifier: "gtk_orientable_get_orientation",
                        returnType: createNormalizedType({ name: "gint" }),
                    }),
                    createNormalizedMethod({
                        name: "set_orientation",
                        cIdentifier: "gtk_orientable_set_orientation",
                        returnType: createNormalizedType({ name: "none" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "orientation",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                        ],
                    }),
                ],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("getOrientation");
            expect(code).toContain("setOrientation");
        });

        it("preserves documentation", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                doc: "Interface for buildable widgets",
                methods: [],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("Interface for buildable widgets");
        });
    });

    describe("context updates", () => {
        it("sets usesNativeObject flag", () => {
            const { generator, sourceFile, ctx } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                methods: [],
            });

            generator.generateToSourceFile(iface, sourceFile);

            expect(ctx.usesNativeObject).toBe(true);
        });

        it("sets usesCall flag when interface has methods", () => {
            const { generator, sourceFile, ctx } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Orientable",
                methods: [
                    createNormalizedMethod({
                        name: "get_value",
                        cIdentifier: "gtk_orientable_get_value",
                        returnType: createNormalizedType({ name: "gint" }),
                    }),
                ],
            });

            generator.generateToSourceFile(iface, sourceFile);

            expect(ctx.usesCall).toBe(true);
        });

        it("sets usesRef flag when method has out parameter", () => {
            const { generator, sourceFile, ctx } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                methods: [
                    createNormalizedMethod({
                        name: "get_value",
                        cIdentifier: "gtk_buildable_get_value",
                        returnType: createNormalizedType({ name: "none" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "out_value",
                                type: createNormalizedType({ name: "gint" }),
                                direction: "out",
                            }),
                        ],
                    }),
                ],
            });

            generator.generateToSourceFile(iface, sourceFile);

            expect(ctx.usesRef).toBe(true);
        });
    });

    describe("method filtering", () => {
        it("filters out methods with unsupported callbacks", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                methods: [
                    createNormalizedMethod({
                        name: "with_closure",
                        cIdentifier: "gtk_buildable_with_closure",
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
                        cIdentifier: "gtk_buildable_normal",
                        returnType: createNormalizedType({ name: "none" }),
                    }),
                ],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("normal");
            expect(code).not.toContain("withClosure");
        });

        it("filters out duplicate methods with same cIdentifier", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                methods: [
                    createNormalizedMethod({
                        name: "get_name",
                        cIdentifier: "gtk_buildable_get_name",
                        returnType: createNormalizedType({ name: "utf8" }),
                    }),
                    createNormalizedMethod({
                        name: "get_name",
                        cIdentifier: "gtk_buildable_get_name",
                        returnType: createNormalizedType({ name: "utf8" }),
                    }),
                ],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            const matches = code.match(/getName\(/g) ?? [];
            expect(matches.length).toBe(1);
        });
    });

    describe("method structure", () => {
        it("converts method names to camelCase", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                methods: [
                    createNormalizedMethod({
                        name: "get_build_name",
                        cIdentifier: "gtk_buildable_get_build_name",
                        returnType: createNormalizedType({ name: "utf8" }),
                    }),
                ],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("getBuildName");
        });

        it("includes parameters in method signature", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                methods: [
                    createNormalizedMethod({
                        name: "set_name",
                        cIdentifier: "gtk_buildable_set_name",
                        returnType: createNormalizedType({ name: "none" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "name",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                    }),
                ],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("name: string");
        });

        it("includes return type for non-void methods", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Buildable",
                methods: [
                    createNormalizedMethod({
                        name: "get_id",
                        cIdentifier: "gtk_buildable_get_id",
                        returnType: createNormalizedType({ name: "gint" }),
                    }),
                ],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain(": number");
        });
    });

    describe("integration", () => {
        it("generates complete interface class", () => {
            const { generator, sourceFile } = createTestSetup();
            const iface = createNormalizedInterface({
                name: "Orientable",
                glibTypeName: "GtkOrientable",
                doc: "Interface for orientable widgets",
                methods: [
                    createNormalizedMethod({
                        name: "get_orientation",
                        cIdentifier: "gtk_orientable_get_orientation",
                        returnType: createNormalizedType({ name: "gint" }),
                        doc: "Gets the orientation",
                    }),
                    createNormalizedMethod({
                        name: "set_orientation",
                        cIdentifier: "gtk_orientable_set_orientation",
                        returnType: createNormalizedType({ name: "none" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "orientation",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                        ],
                    }),
                ],
            });

            generator.generateToSourceFile(iface, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export class Orientable extends NativeObject");
            expect(code).toContain("glibTypeName");
            expect(code).toContain("getOrientation");
            expect(code).toContain("setOrientation");
        });
    });
});
