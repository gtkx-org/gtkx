/**
 * Field Builder
 *
 * Builds field getters/setters for record (struct/boxed) types.
 * Handles struct memory layout calculations, including nested structs.
 */

import type { GirField, GirRecord, GirRepository } from "@gtkx/gir";
import type { Writer } from "../../../builders/writer.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import {
    getPrimitiveTypeSize,
    isMemoryWritableType,
    isPrimitiveFieldType,
} from "../../../core/type-system/ffi-types.js";
import { toCamelCase, toValidMemberName } from "../../../core/utils/naming.js";
import { FfiTypeWriter } from "../../../core/writers/ffi-type-writer.js";
import { addTypeImports, type ImportCollector } from "../../../core/writers/index.js";

/**
 * Field layout information.
 */
type FieldLayout = {
    field: GirField;
    offset: number;
    size: number;
    alignment: number;
};

/**
 * Builds field getters/setters and handles struct memory layout.
 */
export class FieldBuilder {
    private readonly sizeCache = new Map<string, number>();
    private readonly ffiTypeWriter: FfiTypeWriter;

    constructor(
        private readonly ffiMapper: FfiMapper,
        private readonly imports: ImportCollector,
        sharedLibrary: string,
        glibLibrary?: string,
        private readonly repo?: GirRepository,
        private readonly currentNamespace?: string,
    ) {
        this.ffiTypeWriter = new FfiTypeWriter({
            currentSharedLibrary: sharedLibrary,
            glibLibrary,
        });
    }

    /**
     * Calculates struct memory layout for fields.
     * By default excludes private fields (for accessors).
     * Use includePrivate=true for allocation size calculation.
     */
    calculateLayout(fields: readonly GirField[], includePrivate = false): FieldLayout[] {
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
     * Includes private fields since they're needed for memory allocation.
     */
    calculateStructSize(fields: readonly GirField[]): number {
        const layout = this.calculateLayout(fields, true);
        if (layout.length === 0) return 0;

        const lastField = layout[layout.length - 1];
        const rawSize = lastField ? lastField.offset + lastField.size : 0;
        const maxAlignment = Math.max(...layout.map((l) => l.alignment), 1);

        return Math.ceil(rawSize / maxAlignment) * maxAlignment;
    }

    /**
     * Writes field initialization statements.
     */
    writeFieldWrites(fields: readonly GirField[]): (writer: Writer) => void {
        const layout = this.calculateLayout(fields);
        const initializableFields = layout.filter(
            ({ field }) =>
                !field.private &&
                field.writable !== false &&
                this.isGeneratableFieldType(String(field.type.name)) &&
                (this.isWritableType(field.type) || this.isInlineNestedStruct(field)),
        );

        return (writer) => {
            for (const { field, offset } of initializableFields) {
                let fieldName = toValidMemberName(toCamelCase(field.name));
                if (fieldName === "id") fieldName = "id_";

                if (this.isInlineNestedStruct(field)) {
                    const typeName = String(field.type.name);
                    const nestedLayout = this.getNestedStructLayout(typeName);
                    if (!nestedLayout) continue;

                    const typeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
                    this.addFieldTypeImports(typeMapping.imports);

                    writer.writeLine(`if (init.${fieldName} !== undefined) {`);
                    writer.withIndent(() => {
                        for (const nestedItem of nestedLayout) {
                            if (!this.isWritableType(nestedItem.field.type)) continue;
                            const nestedFieldName = toValidMemberName(toCamelCase(nestedItem.field.name));
                            const nestedOffset = offset + nestedItem.offset;
                            const nestedTypeMapping = this.ffiMapper.mapType(
                                nestedItem.field.type,
                                false,
                                nestedItem.field.type.transferOwnership,
                            );

                            writer.write(`write(this.handle, `);
                            writer.write(JSON.stringify(nestedTypeMapping.ffi));
                            writer.writeLine(`, ${nestedOffset}, init.${fieldName}.${nestedFieldName});`);
                        }
                    });
                    writer.writeLine("}");
                } else {
                    const typeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
                    this.addFieldTypeImports(typeMapping.imports);

                    writer.write(`if (init.${fieldName} !== undefined) write(this.handle, `);
                    writer.write(JSON.stringify(typeMapping.ffi));
                    writer.writeLine(`, ${offset}, init.${fieldName});`);
                }
            }
        };
    }

    getWritableFields(fields: readonly GirField[]): GirField[] {
        return fields.filter(
            (f) =>
                !f.private &&
                f.writable !== false &&
                this.isWritableType(f.type) &&
                this.isGeneratableFieldType(String(f.type.name)),
        );
    }

    getInitializableFields(fields: readonly GirField[]): GirField[] {
        return fields.filter(
            (f) =>
                !f.private &&
                f.writable !== false &&
                this.isGeneratableFieldType(String(f.type.name)) &&
                (this.isWritableType(f.type) || this.isInlineNestedStruct(f)),
        );
    }

    /**
     * Checks if a type can be written to memory.
     */
    isWritableType(type: { name: string | unknown; cType?: string }): boolean {
        return isMemoryWritableType(String(type.name));
    }

    /**
     * Checks if a field type is a nested struct (not a primitive).
     */
    isNestedStructType(typeName: string): boolean {
        if (isPrimitiveFieldType(typeName)) return false;
        const record = this.resolveRecord(typeName);
        if (!record || record.opaque || record.disguised) return false;
        if (record.glibTypeName) return false;
        return true;
    }

    /**
     * Checks if a field is an inline nested struct (not a pointer to struct)
     * that has writable sub-fields.
     */
    isInlineNestedStruct(field: GirField): boolean {
        const typeName = String(field.type.name);
        if (!this.isNestedStructType(typeName)) return false;
        const cType = field.type.cType;
        if (cType?.includes("*")) return false;
        const nestedLayout = this.getNestedStructLayout(typeName);
        if (!nestedLayout) return false;
        const hasWritableFields = nestedLayout.some((item) => this.isWritableType(item.field.type));
        return hasWritableFields;
    }

    getNestedStructLayout(typeName: string): FieldLayout[] | null {
        const record = this.resolveRecord(typeName);
        if (!record) return null;
        return this.calculateLayout(record.fields);
    }

    /**
     * Gets the size of a record type for use in array element access.
     */
    getRecordSize(typeName: string): number {
        return this.getFieldSize({ name: typeName });
    }

    isGeneratableFieldType(typeName: string, visited: Set<string> = new Set()): boolean {
        if (isPrimitiveFieldType(typeName)) return true;

        if (visited.has(typeName)) return false;
        visited.add(typeName);

        const resolved = this.resolveRecord(typeName);
        if (!resolved) return false;

        if (resolved.glibTypeName) return true;

        if (resolved.opaque || resolved.disguised) return false;

        const publicFields = resolved.getPublicFields();
        if (publicFields.length === 0) return false;

        return publicFields.every((field) => this.isGeneratableFieldType(field.type.name as string, visited));
    }

    getFfiTypeWriter(): FfiTypeWriter {
        return this.ffiTypeWriter;
    }

    private addFieldTypeImports(imports: Parameters<typeof addTypeImports>[1]): void {
        addTypeImports(this.imports, imports);
    }

    private resolveRecord(typeName: string): GirRecord | null {
        if (!this.repo) return null;

        if (typeName.includes(".")) {
            return this.repo.resolveRecord(typeName);
        }

        if (!this.currentNamespace) return null;
        const ns = this.repo.getNamespace(this.currentNamespace);
        return ns?.records.get(typeName) ?? null;
    }

    private getFieldSize(type: {
        name: string | unknown;
        cType?: string;
        isArray?: boolean;
        elementType?: { name: string | unknown; cType?: string } | null;
        fixedSize?: number;
    }): number {
        if (type.cType?.includes("*")) {
            return 8;
        }

        if (type.isArray && type.fixedSize !== undefined && type.elementType) {
            const elementSize = this.getFieldSize(type.elementType);
            return elementSize * type.fixedSize;
        }

        const typeName = String(type.name);

        if (isPrimitiveFieldType(typeName)) {
            return getPrimitiveTypeSize(typeName);
        }

        const cachedSize = this.sizeCache.get(typeName);
        if (cachedSize !== undefined) {
            return cachedSize;
        }

        const record = this.resolveRecord(typeName);
        if (record && !record.opaque && !record.disguised) {
            this.sizeCache.set(typeName, 0);
            const size = this.calculateStructSize(record.fields);
            this.sizeCache.set(typeName, size);
            return size;
        }

        return 8;
    }

    private getFieldAlignment(
        type: {
            name: string | unknown;
            cType?: string;
            isArray?: boolean;
            elementType?: { name: string | unknown; cType?: string } | null;
            fixedSize?: number;
        },
        visited = new Set<string>(),
    ): number {
        if (type.cType?.includes("*")) {
            return 8;
        }

        if (type.isArray && type.fixedSize !== undefined && type.elementType) {
            return this.getFieldAlignment(type.elementType, visited);
        }

        const typeName = String(type.name);

        if (isPrimitiveFieldType(typeName)) {
            return getPrimitiveTypeSize(typeName);
        }

        if (visited.has(typeName)) {
            return 8;
        }
        visited.add(typeName);

        const record = this.resolveRecord(typeName);
        if (record && !record.opaque && !record.disguised) {
            const fields = record.getPublicFields();
            if (fields.length === 0) return 8;
            return Math.max(...fields.map((f) => this.getFieldAlignment(f.type, visited)));
        }

        return 8;
    }
}
