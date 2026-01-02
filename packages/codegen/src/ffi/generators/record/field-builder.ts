/**
 * Field Builder
 *
 * Builds field getters/setters for record (struct/boxed) types.
 * Handles struct memory layout calculations.
 */

import type { NormalizedField } from "@gtkx/gir";
import type { WriterFunction } from "ts-morph";
import type { GenerationContext } from "../../../core/generation-context.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import { getPrimitiveTypeSize, isMemoryWritableType } from "../../../core/type-system/ffi-types.js";
import { toCamelCase, toValidIdentifier } from "../../../core/utils/naming.js";
import type { Writers } from "../../../core/writers/index.js";

/**
 * Field layout information.
 */
export type FieldLayout = {
    field: NormalizedField;
    offset: number;
    size: number;
    alignment: number;
};

/**
 * Builds field getters/setters and handles struct memory layout.
 */
export class FieldBuilder {
    constructor(
        private readonly ffiMapper: FfiMapper,
        private readonly ctx: GenerationContext,
        private readonly writers: Writers,
    ) {}

    /**
     * Calculates struct memory layout for fields.
     * By default excludes private fields (for accessors).
     * Use includePrivate=true for allocation size calculation.
     */
    calculateLayout(fields: readonly NormalizedField[], includePrivate = false): FieldLayout[] {
        const layout: FieldLayout[] = [];
        let currentOffset = 0;

        for (const field of fields) {
            if (field.private && !includePrivate) continue;

            const size = this.getFieldSize(field.type);
            const alignment = this.getFieldAlignment(field.type);

            currentOffset = Math.ceil(currentOffset / alignment) * alignment;

            layout.push({
                field,
                offset: currentOffset,
                size,
                alignment,
            });

            currentOffset += size;
        }

        return layout;
    }

    /**
     * Calculates total struct size with final alignment padding.
     * Includes private fields since they're needed for memory allocation
     * (e.g., GtkTextIter has only private/dummy fields for internal use).
     */
    calculateStructSize(fields: readonly NormalizedField[]): number {
        const layout = this.calculateLayout(fields, true);
        if (layout.length === 0) return 0;

        const lastField = layout[layout.length - 1];
        const rawSize = lastField ? lastField.offset + lastField.size : 0;
        const maxAlignment = Math.max(...layout.map((l) => l.alignment), 1);

        return Math.ceil(rawSize / maxAlignment) * maxAlignment;
    }

    /**
     * Writes field initialization statements using ts-morph WriterFunction.
     */
    writeFieldWrites(fields: readonly NormalizedField[]): WriterFunction {
        const layout = this.calculateLayout(fields);
        const writeableFields = layout.filter(
            ({ field }) => this.isWritableType(field.type) && field.writable !== false,
        );

        return (writer) => {
            for (const { field, offset } of writeableFields) {
                let fieldName = toValidIdentifier(toCamelCase(field.name));
                if (fieldName === "id") fieldName = "id_";

                const typeMapping = this.ffiMapper.mapType(field.type, false);
                this.ctx.addTypeImports(typeMapping.imports);

                writer.write(`if (init.${fieldName} !== undefined) write(ptr, `);
                this.writers.ffiTypeWriter.toWriter(typeMapping.ffi)(writer);
                writer.writeLine(`, ${offset}, init.${fieldName});`);
            }
        };
    }

    /**
     * Gets writable fields for init interface.
     */
    getWritableFields(fields: readonly NormalizedField[]): NormalizedField[] {
        return fields.filter((f) => !f.private && f.writable !== false && this.isWritableType(f.type));
    }

    /**
     * Checks if a type can be written to memory.
     * Uses MEMORY_WRITABLE_TYPES from type-system/ffi-types.ts.
     */
    isWritableType(type: { name: string | unknown; cType?: string }): boolean {
        return isMemoryWritableType(String(type.name));
    }

    /**
     * Gets the size in bytes for a field type.
     * Uses getPrimitiveTypeSize from type-system/ffi-types.ts.
     */
    private getFieldSize(type: { name: string | unknown; cType?: string }): number {
        return getPrimitiveTypeSize(String(type.name));
    }

    /**
     * Gets the alignment for a field type.
     * For most types, alignment equals size.
     */
    private getFieldAlignment(type: { name: string | unknown; cType?: string }): number {
        return this.getFieldSize(type);
    }
}
