/**
 * Registry Generator
 *
 * Generates the registry.ts file containing namespace registry.
 * Uses ts-morph WriterFunction for proper code generation.
 */

import type { CodeBlockWriter, SourceFile, WriterFunction } from "ts-morph";
import type { CodegenProject } from "../../core/project.js";
import { addNamespaceImports, createConstExport } from "../../core/utils/structure-helpers.js";

/**
 * Generates the registry.ts file containing namespace registry using ts-morph.
 */
export class RegistryGenerator {
    constructor(
        private readonly project: CodegenProject,
        private readonly namespaceNames: string[],
    ) {}

    /**
     * Generates the registry.ts file into the shared project.
     */
    generate(): void {
        const sourceFile = this.project.createReactSourceFile("registry.ts");

        sourceFile.addStatements("/** Generated namespace registry for widget class resolution. */\n");

        this.addImports(sourceFile, this.namespaceNames);
        this.addNamespaceType(sourceFile);
        this.addNamespaceRegistry(sourceFile, this.namespaceNames);
    }

    private addImports(sourceFile: SourceFile, namespaces: string[]): void {
        addNamespaceImports(sourceFile, namespaces);
    }

    private addNamespaceType(sourceFile: SourceFile): void {
        sourceFile.addTypeAlias({
            name: "Namespace",
            type: "Record<string, unknown>",
        });
    }

    /**
     * Creates a WriterFunction for the namespace registry array.
     * Uses ts-morph writer for proper formatting.
     */
    private writeRegistryArray(namespaces: string[]): WriterFunction {
        const sortedByLength = [...namespaces].sort((a, b) => b.length - a.length || a.localeCompare(b));

        return (writer: CodeBlockWriter) => {
            writer.writeLine("[");
            writer.indent(() => {
                for (const ns of sortedByLength) {
                    writer.writeLine(`["${ns}", ${ns}],`);
                }
            });
            writer.write("]");
        };
    }

    private addNamespaceRegistry(sourceFile: SourceFile, namespaces: string[]): void {
        sourceFile.addVariableStatement(
            createConstExport("NAMESPACE_REGISTRY", this.writeRegistryArray(namespaces), {
                type: "[string, Namespace][]",
            }),
        );
    }
}
