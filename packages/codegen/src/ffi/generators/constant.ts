/**
 * Constant Generator (ts-morph)
 *
 * Generates constant definitions using ts-morph AST.
 */

import type { NormalizedConstant } from "@gtkx/gir";
import type { SourceFile, VariableStatementStructure } from "ts-morph";
import type { SimpleGeneratorOptions } from "../../core/generator-types.js";
import { buildJsDocStructure } from "../../core/utils/doc-formatter.js";
import { createConstExport } from "../../core/utils/structure-helpers.js";

/**
 * Generates constant definitions into a ts-morph SourceFile.
 *
 * @example
 * ```typescript
 * const generator = new ConstantGenerator(sourceFile, { namespace: "Gtk" });
 * generator.addConstants(constants);
 * ```
 */
export class ConstantGenerator {
    private readonly seen = new Set<string>();

    constructor(
        private readonly sourceFile: SourceFile,
        private readonly options: SimpleGeneratorOptions,
    ) {}

    /**
     * Adds multiple constants to the source file using batched insertion for performance.
     */
    addConstants(constants: readonly NormalizedConstant[]): void {
        const structures: VariableStatementStructure[] = [];

        for (const constant of constants) {
            const structure = this.buildConstantStructure(constant);
            if (structure) {
                structures.push(structure);
            }
        }

        if (structures.length > 0) {
            this.sourceFile.addVariableStatements(structures);
        }
    }

    /**
     * Builds a variable statement structure for a single constant.
     */
    private buildConstantStructure(constant: NormalizedConstant): VariableStatementStructure | null {
        const constName = constant.name;

        if (this.seen.has(constName)) {
            return null;
        }
        this.seen.add(constName);

        const isStringType = constant.type.name === "utf8" || constant.type.name === "filename";
        const constValue = isStringType ? `"${constant.value}"` : constant.value;

        return createConstExport(constName, constValue, {
            docs: buildJsDocStructure(constant.doc, this.options.namespace),
        });
    }
}
