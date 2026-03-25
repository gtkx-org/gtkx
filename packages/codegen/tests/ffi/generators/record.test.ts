import { describe, expect, it } from "vitest";
import { fileBuilder } from "../../../src/builders/file-builder.js";
import { stringify } from "../../../src/builders/stringify.js";
import { FfiMapper } from "../../../src/core/type-system/ffi-mapper.js";
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

function createTestSetup(namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map()) {
    const ns = createNormalizedNamespace({ name: "Gdk" });
    namespaces.set("Gdk", ns);
    const repo = createMockRepository(namespaces);
    const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gdk");
    const file = fileBuilder();
    const options = {
        namespace: "Gdk",
        sharedLibrary: "libgdk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
        gobjectLibrary: "libgobject-2.0.so.0",
    };
    const generator = new RecordGenerator(ffiMapper, file, options);
    return { generator, file, repo };
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
            const { generator, file } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                fields: [],
            });

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("export class Rectangle");
        });

        it("extends NativeObject", () => {
            const { generator, file } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                fields: [],
            });

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("extends NativeObject");
        });

        it("adds glibTypeName property when present", () => {
            const { generator, file } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                glibTypeName: "GdkRectangle",
                fields: [],
            });

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("glibTypeName");
            expect(code).toContain('"GdkRectangle"');
        });

        it("adds objectType as boxed when glibTypeName present", () => {
            const { generator, file } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                glibTypeName: "GdkRectangle",
                fields: [],
            });

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("objectType");
            expect(code).toContain('"boxed"');
        });

        it("adds objectType as struct when no glibTypeName", () => {
            const { generator, file } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                glibTypeName: undefined,
                fields: [],
            });

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("objectType");
            expect(code).toContain('"struct"');
        });

        it("adds objectType as fundamental for records with copy/free functions", () => {
            const glibNs = createNormalizedNamespace({ name: "GLib" });
            const namespaces = new Map([["GLib", glibNs]]);
            const repo = createMockRepository(namespaces);
            const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "GLib");
            const glibFile = fileBuilder();
            const options = {
                namespace: "GLib",
                sharedLibrary: "libglib-2.0.so.0",
                glibLibrary: "libglib-2.0.so.0",
                gobjectLibrary: "libgobject-2.0.so.0",
            };
            const generator = new RecordGenerator(ffiMapper, glibFile, options);

            const record = createNormalizedRecord({
                name: "Variant",
                glibTypeName: "GVariant",
                copyFunction: "g_variant_ref_sink",
                freeFunction: "g_variant_unref",
                fields: [],
            });

            generator.generate(record);

            const code = stringify(glibFile);
            expect(code).toContain('"fundamental"');
        });

        it("adds registerNativeClass call when glibTypeName present", () => {
            const { generator, file } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                glibTypeName: "GdkRectangle",
                fields: [],
            });

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("registerNativeClass(Rectangle)");
        });
    });

    describe("field generation", () => {
        it("generates accessor for readable field", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("get x()");
            expect(code).toContain("set x(");
        });

        it("generates setter for writable field", () => {
            const { generator, file } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                glibTypeName: "GdkRectangle",
                fields: [
                    createNormalizedField({
                        name: "x",
                        type: createNormalizedType({ name: "gint" }),
                        readable: true,
                        writable: true,
                    }),
                ],
            });

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("set x(value");
        });

        it("converts field names to camelCase", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("get someField()");
        });

        it("renames id field to id_", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("get id_()");
        });
    });

    describe("constructor generation", () => {
        it("generates constructor with init parameter when no main constructor", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("RectangleInit");
        });

        it("generates constructor from main constructor", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("constructor()");
        });

        it("generates factory methods for non-main constructors", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("static newFromCoords");
        });
    });

    describe("method generation", () => {
        it("generates instance methods", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("getArea");
        });

        it("generates static functions", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("static intersect");
        });

        it("includes methods with GLib.Closure callbacks", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("normal");
            expect(code).toContain("withClosure");
        });
    });

    describe("init interface generation", () => {
        it("generates init interface when no main constructor", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("export type RectangleInit");
        });

        it("includes writable fields in init interface", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("x?:");
            expect(code).toContain("y?:");
        });

        it("does not generate init interface when main constructor exists", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            const code = stringify(file);
            expect(code).not.toContain("RectangleInit");
        });
    });

    describe("context updates", () => {
        it("sets usesNativeObject flag", () => {
            const { generator, file } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                fields: [],
            });

            generator.generate(record);

            expect(stringify(file)).toContain("NativeObject");
        });

        it("sets usesCall flag when record has methods", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            expect(stringify(file)).toContain("call");
        });

        it("sets usesRead flag when record has readable fields", () => {
            const { generator, file } = createTestSetup();
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

            generator.generate(record);

            expect(stringify(file)).toContain("read");
        });

        it("sets usesRegisterNativeClass flag when glibTypeName present", () => {
            const { generator, file } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                glibTypeName: "GdkRectangle",
                fields: [],
            });

            generator.generate(record);

            expect(stringify(file)).toContain("registerNativeClass");
        });
    });

    describe("JSDoc generation", () => {
        it("includes record documentation", () => {
            const { generator, file } = createTestSetup();
            const record = createNormalizedRecord({
                name: "Rectangle",
                doc: "A rectangle with integer coordinates",
                fields: [],
            });

            generator.generate(record);

            const code = stringify(file);
            expect(code).toContain("A rectangle with integer coordinates");
        });
    });
});
