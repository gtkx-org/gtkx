import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../../src/core/generation-context.js";
import { FfiMapper } from "../../../src/core/type-system/ffi-mapper.js";
import { createWriters } from "../../../src/core/writers/index.js";
import { RecordGenerator } from "../../../src/ffi/generators/record/index.js";
import {
    createNormalizedConstructor,
    createNormalizedField,
    createNormalizedMethod,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedRecord,
    createNormalizedType,
} from "../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../fixtures/mock-repository.js";
import { createTestProject, createTestSourceFile, getGeneratedCode } from "../../fixtures/ts-morph-helpers.js";

function createTestSetup(namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map()) {
    const ns = createNormalizedNamespace({ name: "Gdk" });
    namespaces.set("Gdk", ns);
    const repo = createMockRepository(namespaces);
    const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gdk");
    const ctx = new GenerationContext();
    const writers = createWriters({
        sharedLibrary: "libgdk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
    });
    const options = {
        namespace: "Gdk",
        sharedLibrary: "libgdk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
        gobjectLibrary: "libgobject-2.0.so.0",
    };
    const project = createTestProject();
    const sourceFile = createTestSourceFile(project, "record.ts");
    const generator = new RecordGenerator(ffiMapper, ctx, writers, options);
    return { generator, ctx, sourceFile, project, repo };
}

describe("RecordGenerator", () => {
    describe("constructor", () => {
        it("creates generator with dependencies", () => {
            const { generator } = createTestSetup();
            expect(generator).toBeInstanceOf(RecordGenerator);
        });
    });

    describe("generateToSourceFile", () => {
        it("generates class with correct name", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export class Rectangle");
        });

        it("extends NativeObject", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("extends NativeObject");
        });

        it("adds glibTypeName property when present", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                glibTypeName: "GdkRectangle",
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("glibTypeName");
            expect(code).toContain('"GdkRectangle"');
        });

        it("adds objectType as boxed when glibTypeName present", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                glibTypeName: "GdkRectangle",
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("objectType");
            expect(code).toContain('"boxed"');
        });

        it("adds objectType as struct when no glibTypeName", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                glibTypeName: undefined,
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("objectType");
            expect(code).toContain('"struct"');
        });

        it("adds objectType as gvariant for GVariant", () => {
            const glibNs = createNormalizedNamespace({ name: "GLib" });
            const namespaces = new Map([["GLib", glibNs]]);
            const repo = createMockRepository(namespaces);
            const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "GLib");
            const ctx = new GenerationContext();
            const writers = createWriters({
                sharedLibrary: "libglib-2.0.so.0",
                glibLibrary: "libglib-2.0.so.0",
            });
            const options = {
                namespace: "GLib",
                sharedLibrary: "libglib-2.0.so.0",
                glibLibrary: "libglib-2.0.so.0",
                gobjectLibrary: "libgobject-2.0.so.0",
            };
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "variant.ts");
            const generator = new RecordGenerator(ffiMapper, ctx, writers, options);

            const record = createNormalizedRecord({
                name: "Variant",
                glibTypeName: "GVariant",
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain('"gvariant"');
        });

        it("generates fromPtr static method", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("static fromPtr");
        });

        it("adds registerNativeClass call when glibTypeName present", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                glibTypeName: "GdkRectangle",
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("registerNativeClass(Rectangle)");
        });
    });

    describe("field generation", () => {
        it("generates getter for readable field", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                fields: [
                    createNormalizedField({
                        name: "x",
                        type: createNormalizedType({ name: "gint" }),
                        readable: true,
                        writable: true,
                    }),
                ],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("get x()");
        });

        it("generates setter for writable field", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                fields: [
                    createNormalizedField({
                        name: "x",
                        type: createNormalizedType({ name: "gint" }),
                        readable: true,
                        writable: true,
                    }),
                ],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("set x(value");
        });

        it("converts field names to camelCase", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                fields: [
                    createNormalizedField({
                        name: "some_field",
                        type: createNormalizedType({ name: "gint" }),
                        readable: true,
                        writable: true,
                    }),
                ],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("get someField()");
        });

        it("renames id field to id_", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Event",
                fields: [
                    createNormalizedField({
                        name: "id",
                        type: createNormalizedType({ name: "gint" }),
                        readable: true,
                        writable: true,
                    }),
                ],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("get id_()");
        });
    });

    describe("constructor generation", () => {
        it("generates constructor with init parameter when no main constructor", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                constructors: [],
                fields: [
                    createNormalizedField({
                        name: "x",
                        type: createNormalizedType({ name: "gint" }),
                        readable: true,
                        writable: true,
                    }),
                ],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("RectangleInit");
        });

        it("generates constructor from main constructor", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gdk_rectangle_new",
                        returnType: createNormalizedType({ name: "Gdk.Rectangle" }),
                        parameters: [],
                    }),
                ],
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("constructor()");
        });

        it("generates factory methods for non-main constructors", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gdk_rectangle_new",
                        returnType: createNormalizedType({ name: "Gdk.Rectangle" }),
                        parameters: [],
                    }),
                    createNormalizedConstructor({
                        name: "new_from_coords",
                        cIdentifier: "gdk_rectangle_new_from_coords",
                        returnType: createNormalizedType({ name: "Gdk.Rectangle" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "x",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                        ],
                    }),
                ],
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("static newFromCoords");
        });
    });

    describe("method generation", () => {
        it("generates instance methods", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                methods: [
                    createNormalizedMethod({
                        name: "get_area",
                        cIdentifier: "gdk_rectangle_get_area",
                        returnType: createNormalizedType({ name: "gint" }),
                    }),
                ],
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("getArea");
        });

        it("generates static functions", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                staticFunctions: [
                    {
                        name: "intersect",
                        cIdentifier: "gdk_rectangle_intersect",
                        returnType: createNormalizedType({ name: "gboolean" }),
                        parameters: [],
                        throws: false,
                    },
                ],
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("static intersect");
        });

        it("filters out methods with unsupported callbacks", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                methods: [
                    createNormalizedMethod({
                        name: "with_closure",
                        cIdentifier: "gdk_rectangle_with_closure",
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
                        cIdentifier: "gdk_rectangle_normal",
                        returnType: createNormalizedType({ name: "none" }),
                    }),
                ],
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("normal");
            expect(code).not.toContain("withClosure");
        });
    });

    describe("init interface generation", () => {
        it("generates init interface when no main constructor", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                constructors: [],
                fields: [
                    createNormalizedField({
                        name: "x",
                        type: createNormalizedType({ name: "gint" }),
                        readable: true,
                        writable: true,
                    }),
                ],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export interface RectangleInit");
        });

        it("includes writable fields in init interface", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                constructors: [],
                fields: [
                    createNormalizedField({
                        name: "x",
                        type: createNormalizedType({ name: "gint" }),
                        readable: true,
                        writable: true,
                    }),
                    createNormalizedField({
                        name: "y",
                        type: createNormalizedType({ name: "gint" }),
                        readable: true,
                        writable: true,
                    }),
                ],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("x?:");
            expect(code).toContain("y?:");
        });

        it("does not generate init interface when main constructor exists", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gdk_rectangle_new",
                        returnType: createNormalizedType({ name: "Gdk.Rectangle" }),
                        parameters: [],
                    }),
                ],
                fields: [
                    createNormalizedField({
                        name: "x",
                        type: createNormalizedType({ name: "gint" }),
                        readable: true,
                        writable: true,
                    }),
                ],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).not.toContain("RectangleInit");
        });
    });

    describe("context updates", () => {
        it("sets usesNativeObject flag", () => {
            const { generator, sourceFile, ctx } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            expect(ctx.usesNativeObject).toBe(true);
        });

        it("sets usesCall flag when record has methods", () => {
            const { generator, sourceFile, ctx } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                methods: [
                    createNormalizedMethod({
                        name: "get_value",
                        cIdentifier: "gdk_rectangle_get_value",
                        returnType: createNormalizedType({ name: "gint" }),
                    }),
                ],
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            expect(ctx.usesCall).toBe(true);
        });

        it("sets usesRead flag when record has readable fields", () => {
            const { generator, sourceFile, ctx } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                fields: [
                    createNormalizedField({
                        name: "x",
                        type: createNormalizedType({ name: "gint" }),
                        readable: true,
                        writable: false,
                    }),
                ],
            });

            generator.generateToSourceFile(record, sourceFile);

            expect(ctx.usesRead).toBe(true);
        });

        it("sets usesRegisterNativeClass flag when glibTypeName present", () => {
            const { generator, sourceFile, ctx } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                glibTypeName: "GdkRectangle",
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            expect(ctx.usesRegisterNativeClass).toBe(true);
        });
    });

    describe("JSDoc generation", () => {
        it("includes record documentation", () => {
            const { generator, sourceFile } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                doc: "A rectangle with integer coordinates",
                fields: [],
            });

            generator.generateToSourceFile(record, sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("A rectangle with integer coordinates");
        });
    });
});
