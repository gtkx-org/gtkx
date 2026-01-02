import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../../../src/core/generation-context.js";
import { FfiMapper } from "../../../../src/core/type-system/ffi-mapper.js";
import { createWriters } from "../../../../src/core/writers/index.js";
import { FieldBuilder } from "../../../../src/ffi/generators/record/field-builder.js";
import {
    createNormalizedField,
    createNormalizedNamespace,
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
    const builder = new FieldBuilder(ffiMapper, ctx, writers);
    return { builder, ctx, ffiMapper };
}

describe("FieldBuilder", () => {
    describe("constructor", () => {
        it("creates builder with dependencies", () => {
            const { builder } = createTestSetup();
            expect(builder).toBeInstanceOf(FieldBuilder);
        });
    });

    describe("calculateLayout", () => {
        it("returns empty array for empty fields", () => {
            const { builder } = createTestSetup();

            const layout = builder.calculateLayout([]);

            expect(layout).toHaveLength(0);
        });

        it("calculates layout for single field", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "value",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ];

            const layout = builder.calculateLayout(fields);

            expect(layout).toHaveLength(1);
            expect(layout[0].offset).toBe(0);
            expect(layout[0].size).toBe(4);
        });

        it("calculates layout for multiple fields", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "x",
                    type: createNormalizedType({ name: "gint" }),
                }),
                createNormalizedField({
                    name: "y",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ];

            const layout = builder.calculateLayout(fields);

            expect(layout).toHaveLength(2);
            expect(layout[0].offset).toBe(0);
            expect(layout[1].offset).toBe(4);
        });

        it("excludes private fields by default", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "public_field",
                    type: createNormalizedType({ name: "gint" }),
                    private: false,
                }),
                createNormalizedField({
                    name: "private_field",
                    type: createNormalizedType({ name: "gint" }),
                    private: true,
                }),
            ];

            const layout = builder.calculateLayout(fields);

            expect(layout).toHaveLength(1);
            expect(layout[0].field.name).toBe("public_field");
        });

        it("includes private fields when includePrivate is true", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "public_field",
                    type: createNormalizedType({ name: "gint" }),
                    private: false,
                }),
                createNormalizedField({
                    name: "private_field",
                    type: createNormalizedType({ name: "gint" }),
                    private: true,
                }),
            ];

            const layout = builder.calculateLayout(fields, true);

            expect(layout).toHaveLength(2);
        });

        it("handles alignment for different sized types", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "byte",
                    type: createNormalizedType({ name: "guint8" }),
                }),
                createNormalizedField({
                    name: "int",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ];

            const layout = builder.calculateLayout(fields);

            expect(layout[0].offset).toBe(0);
            expect(layout[0].size).toBe(1);
            expect(layout[1].offset).toBe(4);
        });

        it("calculates correct sizes for various types", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "byte",
                    type: createNormalizedType({ name: "guint8" }),
                }),
                createNormalizedField({
                    name: "short",
                    type: createNormalizedType({ name: "gint16" }),
                }),
                createNormalizedField({
                    name: "int",
                    type: createNormalizedType({ name: "gint" }),
                }),
                createNormalizedField({
                    name: "long",
                    type: createNormalizedType({ name: "gint64" }),
                }),
            ];

            const layout = builder.calculateLayout(fields);

            expect(layout[0].size).toBe(1);
            expect(layout[1].size).toBe(2);
            expect(layout[2].size).toBe(4);
            expect(layout[3].size).toBe(8);
        });

        it("preserves field reference in layout", () => {
            const { builder } = createTestSetup();
            const field = createNormalizedField({
                name: "test",
                type: createNormalizedType({ name: "gint" }),
            });

            const layout = builder.calculateLayout([field]);

            expect(layout[0].field).toBe(field);
        });
    });

    describe("calculateStructSize", () => {
        it("returns 0 for empty fields", () => {
            const { builder } = createTestSetup();

            const size = builder.calculateStructSize([]);

            expect(size).toBe(0);
        });

        it("calculates size for single field", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "value",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ];

            const size = builder.calculateStructSize(fields);

            expect(size).toBe(4);
        });

        it("calculates size for multiple fields", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "x",
                    type: createNormalizedType({ name: "gint" }),
                }),
                createNormalizedField({
                    name: "y",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ];

            const size = builder.calculateStructSize(fields);

            expect(size).toBe(8);
        });

        it("includes alignment padding in total size", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "byte",
                    type: createNormalizedType({ name: "guint8" }),
                }),
                createNormalizedField({
                    name: "long",
                    type: createNormalizedType({ name: "gint64" }),
                }),
            ];

            const size = builder.calculateStructSize(fields);

            expect(size).toBe(16);
        });

        it("includes private fields in size calculation", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "public",
                    type: createNormalizedType({ name: "gint" }),
                    private: false,
                }),
                createNormalizedField({
                    name: "private",
                    type: createNormalizedType({ name: "gint" }),
                    private: true,
                }),
            ];

            const size = builder.calculateStructSize(fields);

            expect(size).toBe(8);
        });
    });

    describe("getWritableFields", () => {
        it("returns empty array for empty fields", () => {
            const { builder } = createTestSetup();

            const writable = builder.getWritableFields([]);

            expect(writable).toHaveLength(0);
        });

        it("includes writable primitive fields", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "value",
                    type: createNormalizedType({ name: "gint" }),
                    writable: true,
                }),
            ];

            const writable = builder.getWritableFields(fields);

            expect(writable).toHaveLength(1);
        });

        it("excludes private fields", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "public",
                    type: createNormalizedType({ name: "gint" }),
                    writable: true,
                    private: false,
                }),
                createNormalizedField({
                    name: "private",
                    type: createNormalizedType({ name: "gint" }),
                    writable: true,
                    private: true,
                }),
            ];

            const writable = builder.getWritableFields(fields);

            expect(writable).toHaveLength(1);
            expect(writable[0].name).toBe("public");
        });

        it("excludes explicitly non-writable fields", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "writable",
                    type: createNormalizedType({ name: "gint" }),
                    writable: true,
                }),
                createNormalizedField({
                    name: "readonly",
                    type: createNormalizedType({ name: "gint" }),
                    writable: false,
                }),
            ];

            const writable = builder.getWritableFields(fields);

            expect(writable).toHaveLength(1);
            expect(writable[0].name).toBe("writable");
        });

        it("excludes non-memory-writable types", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "primitive",
                    type: createNormalizedType({ name: "gint" }),
                    writable: true,
                }),
                createNormalizedField({
                    name: "object",
                    type: createNormalizedType({ name: "Gtk.Widget" }),
                    writable: true,
                }),
            ];

            const writable = builder.getWritableFields(fields);

            expect(writable).toHaveLength(1);
            expect(writable[0].name).toBe("primitive");
        });
    });

    describe("isWritableType", () => {
        it("returns true for primitive integer types", () => {
            const { builder } = createTestSetup();

            expect(builder.isWritableType({ name: "gint" })).toBe(true);
            expect(builder.isWritableType({ name: "guint" })).toBe(true);
            expect(builder.isWritableType({ name: "gint8" })).toBe(true);
            expect(builder.isWritableType({ name: "guint8" })).toBe(true);
            expect(builder.isWritableType({ name: "gint16" })).toBe(true);
            expect(builder.isWritableType({ name: "guint16" })).toBe(true);
            expect(builder.isWritableType({ name: "gint32" })).toBe(true);
            expect(builder.isWritableType({ name: "guint32" })).toBe(true);
            expect(builder.isWritableType({ name: "gint64" })).toBe(true);
            expect(builder.isWritableType({ name: "guint64" })).toBe(true);
        });

        it("returns true for floating point types", () => {
            const { builder } = createTestSetup();

            expect(builder.isWritableType({ name: "gfloat" })).toBe(true);
            expect(builder.isWritableType({ name: "gdouble" })).toBe(true);
        });

        it("returns true for boolean type", () => {
            const { builder } = createTestSetup();

            expect(builder.isWritableType({ name: "gboolean" })).toBe(true);
        });

        it("returns false for object types", () => {
            const { builder } = createTestSetup();

            expect(builder.isWritableType({ name: "Gtk.Widget" })).toBe(false);
            expect(builder.isWritableType({ name: "GObject.Object" })).toBe(false);
        });

        it("returns false for string types", () => {
            const { builder } = createTestSetup();

            expect(builder.isWritableType({ name: "utf8" })).toBe(false);
            expect(builder.isWritableType({ name: "filename" })).toBe(false);
        });
    });

    describe("alignment", () => {
        it("aligns 2-byte types to 2-byte boundaries", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "byte",
                    type: createNormalizedType({ name: "guint8" }),
                }),
                createNormalizedField({
                    name: "short",
                    type: createNormalizedType({ name: "gint16" }),
                }),
            ];

            const layout = builder.calculateLayout(fields);

            expect(layout[1].offset).toBe(2);
        });

        it("aligns 4-byte types to 4-byte boundaries", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "byte",
                    type: createNormalizedType({ name: "guint8" }),
                }),
                createNormalizedField({
                    name: "int",
                    type: createNormalizedType({ name: "gint" }),
                }),
            ];

            const layout = builder.calculateLayout(fields);

            expect(layout[1].offset).toBe(4);
        });

        it("aligns 8-byte types to 8-byte boundaries", () => {
            const { builder } = createTestSetup();
            const fields = [
                createNormalizedField({
                    name: "byte",
                    type: createNormalizedType({ name: "guint8" }),
                }),
                createNormalizedField({
                    name: "long",
                    type: createNormalizedType({ name: "gint64" }),
                }),
            ];

            const layout = builder.calculateLayout(fields);

            expect(layout[1].offset).toBe(8);
        });
    });
});
