/**
 * Structure Helpers
 *
 * Helper functions for building ts-morph structures and WriterFunctions.
 */

import type {
    CodeBlockWriter,
    JSDocStructure,
    OptionalKind,
    SourceFile,
    VariableStatementStructure,
    WriterFunction,
} from "ts-morph";
import { StructureKind, VariableDeclarationKind } from "ts-morph";

/**
 * Writes an array literal using a CodeBlockWriter.
 * @param items - Array items as strings (already formatted)
 * @param options - Formatting options
 */
function writeArray(items: readonly string[], options?: { singleLine?: boolean }): WriterFunction {
    return (writer: CodeBlockWriter) => {
        if (items.length === 0) {
            writer.write("[]");
            return;
        }
        if (options?.singleLine) {
            writer.write(`[${items.join(", ")}]`);
        } else {
            writer.write("[");
            writer.newLine();
            writer.indent(() => {
                for (const item of items) {
                    writer.writeLine(`${item},`);
                }
            });
            writer.write("]");
        }
    };
}

/**
 * Writes a const string array literal: `["a", "b"] as const`
 * @param items - String values (will be quoted)
 * @param options - Formatting options
 */
export function writeConstStringArray(items: readonly string[], options?: { singleLine?: boolean }): WriterFunction {
    return (writer: CodeBlockWriter) => {
        writeArray(
            items.map((s) => `"${s}"`),
            options ?? { singleLine: true },
        )(writer);
        writer.write(" as const");
    };
}

/**
 * Writes a const array of identifiers: `[A, B] as const`
 * @param items - Identifier names (not quoted)
 * @param options - Formatting options
 */
export function writeConstIdentifierArray(
    items: readonly string[],
    options?: { singleLine?: boolean },
): WriterFunction {
    return (writer: CodeBlockWriter) => {
        writeArray(items, options ?? { singleLine: true })(writer);
        writer.write(" as const");
    };
}

/**
 * Writes a string array literal: `["a", "b"]`
 * @param items - String values (will be quoted)
 * @param options - Formatting options
 */
export function writeStringArray(items: readonly string[], options?: { singleLine?: boolean }): WriterFunction {
    return (writer: CodeBlockWriter) => {
        writeArray(
            items.map((s) => `"${s}"`),
            options ?? { singleLine: true },
        )(writer);
    };
}

/**
 * Writes a Set literal containing strings: `new Set(["a", "b"])`
 * @param items - String values (will be quoted)
 */
export function writeStringSet(items: readonly string[]): WriterFunction {
    return (writer: CodeBlockWriter) => {
        writer.write("new Set(");
        writeStringArray(items, { singleLine: true })(writer);
        writer.write(")");
    };
}

/**
 * Writes an object literal or empty object fallback.
 * Centralizes the common pattern of checking for empty objects.
 * @param properties - Object properties to write
 * @param Writers - ts-morph Writers module (passed to avoid import dependency)
 */
export function writeObjectOrEmpty(
    properties: Record<string, WriterFunction>,
    Writers: { object: (properties: Record<string, WriterFunction>) => WriterFunction },
): WriterFunction {
    return Object.keys(properties).length > 0
        ? Writers.object(properties)
        : (writer: CodeBlockWriter) => writer.write("{}");
}

/**
 * Adds namespace import declarations to a source file.
 * Centralizes the common pattern of adding `@gtkx/ffi/<namespace>` imports.
 * @param sourceFile - The ts-morph SourceFile to add imports to
 * @param namespaces - Array or Set of namespace names (e.g., ["Gtk", "Adw"])
 * @param options - Optional configuration
 */
export function addNamespaceImports(
    sourceFile: SourceFile,
    namespaces: string[] | Set<string>,
    options?: { isTypeOnly?: boolean },
): void {
    const sorted = [...namespaces].sort();
    for (const ns of sorted) {
        sourceFile.addImportDeclaration({
            moduleSpecifier: `@gtkx/ffi/${ns.toLowerCase()}`,
            namespaceImport: ns,
            isTypeOnly: options?.isTypeOnly,
        });
    }
}

export type ConstExportOptions = {
    type?: string;
    docs?: string | OptionalKind<JSDocStructure>[];
};

export type FromPtrStatements = string[];

export function buildFromPtrStatements(className: string): FromPtrStatements {
    return [
        `const instance = Object.create(${className}.prototype) as ${className};`,
        "instance.id = ptr;",
        "return instance;",
    ];
}

/**
 * Creates a variable statement structure for an exported const.
 * Centralizes the common pattern of creating const exports.
 * @param name - Variable name
 * @param initializer - WriterFunction or string initializer
 * @param options - Optional type and docs configuration
 */
export function createConstExport(
    name: string,
    initializer: WriterFunction | string,
    options?: ConstExportOptions,
): VariableStatementStructure {
    const docs = options?.docs
        ? typeof options.docs === "string"
            ? [{ description: options.docs }]
            : options.docs
        : undefined;

    return {
        kind: StructureKind.VariableStatement,
        isExported: true,
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
            {
                kind: StructureKind.VariableDeclaration,
                name,
                type: options?.type,
                initializer,
            },
        ],
        docs,
    };
}
