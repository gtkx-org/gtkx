/**
 * Enum Generator (ts-morph)
 *
 * Generates enum definitions using ts-morph AST.
 */

import type { GirEnumeration } from "@gtkx/gir";
import { type EnumDeclarationStructure, type SourceFile, StructureKind } from "ts-morph";
import type { SimpleGeneratorOptions } from "../../core/generator-types.js";
import { buildJsDocStructure } from "../../core/utils/doc-formatter.js";
import { toConstantCase, toPascalCase } from "../../core/utils/naming.js";

/**
 * Generates enum definitions into a ts-morph SourceFile.
 *
 * @example
 * ```typescript
 * const generator = new EnumGenerator(sourceFile, { namespace: "Gtk" });
 * generator.addEnums(enumerations);
 * ```
 */
export class EnumGenerator {
    constructor(
        private readonly sourceFile: SourceFile,
        private readonly options: SimpleGeneratorOptions,
    ) {}

    /**
     * Adds multiple enums to the source file using batched insertion for performance.
     */
    addEnums(enumerations: readonly GirEnumeration[]): void {
        const structures: EnumDeclarationStructure[] = [];

        for (const enumeration of enumerations) {
            structures.push(this.buildEnumStructure(enumeration));
        }

        if (structures.length > 0) {
            this.sourceFile.addEnums(structures);
        }
    }

    private buildEnumStructure(enumeration: GirEnumeration): EnumDeclarationStructure {
        const enumName = toPascalCase(enumeration.name);

        const seenNames = new Set<string>();
        const members = enumeration.members
            .map((member) => {
                let memberName = toConstantCase(member.name);
                if (/^\d/.test(memberName)) {
                    memberName = `_${memberName}`;
                }

                if (seenNames.has(memberName)) {
                    return null;
                }
                seenNames.add(memberName);

                return {
                    kind: StructureKind.EnumMember as const,
                    name: memberName,
                    value: Number(member.value),
                    docs: buildJsDocStructure(member.doc, this.options.namespace),
                };
            })
            .filter(<T>(m: T | null): m is T => m !== null);

        return {
            kind: StructureKind.Enum,
            name: enumName,
            isExported: true,
            members,
            docs: buildJsDocStructure(enumeration.doc, this.options.namespace),
        };
    }
}
