/**
 * Function Generator (ts-morph)
 *
 * Generates standalone exported functions using ts-morph AST.
 */

import type { NormalizedFunction } from "@gtkx/gir";
import type { SourceFile, VariableStatementStructure, WriterFunction } from "ts-morph";
import { StructureKind, VariableDeclarationKind } from "ts-morph";
import type { GenerationContext } from "../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../core/generator-types.js";
import type { FfiMapper } from "../../core/type-system/ffi-mapper.js";
import { buildJsDocStructure } from "../../core/utils/doc-formatter.js";
import { filterSupportedFunctions } from "../../core/utils/filtering.js";
import { toCamelCase, toValidIdentifier } from "../../core/utils/naming.js";
import { formatNullableReturn } from "../../core/utils/type-qualification.js";
import type { Writers } from "../../core/writers/index.js";
import { MethodBodyWriter } from "../../core/writers/method-body-writer.js";

/**
 * Generates standalone exported functions.
 *
 * @example
 * ```typescript
 * const generator = new FunctionGenerator(ffiMapper, ctx, builders, options);
 * generator.generateToSourceFile(functions, sourceFile);
 * ```
 */
export class FunctionGenerator {
    private readonly methodBody: MethodBodyWriter;

    constructor(
        private readonly ffiMapper: FfiMapper,
        private readonly ctx: GenerationContext,
        writers: Writers,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.methodBody = new MethodBodyWriter(ffiMapper, ctx, writers.ffiTypeWriter);
    }

    /**
     * Generates into a ts-morph SourceFile.
     *
     * @param functions - The functions to generate
     * @param sourceFile - The ts-morph SourceFile to generate into
     * @returns true if any functions were generated
     *
     * @example
     * ```typescript
     * const generator = new FunctionGenerator(ffiMapper, ctx, builders, options);
     * generator.generateToSourceFile(functions, sourceFile);
     * ```
     */
    generateToSourceFile(functions: NormalizedFunction[], sourceFile: SourceFile): boolean {
        const supportedFunctions = this.filterAndTrackFeatures(functions);

        const structures: VariableStatementStructure[] = [];
        for (const func of supportedFunctions) {
            structures.push(this.buildFunctionStructure(func));
        }

        if (structures.length > 0) {
            sourceFile.addVariableStatements(structures);
        }

        return supportedFunctions.length > 0;
    }

    /**
     * Filters functions and tracks feature usage in context.
     */
    private filterAndTrackFeatures(functions: NormalizedFunction[]): NormalizedFunction[] {
        const supportedFunctions = filterSupportedFunctions(functions, (params) =>
            this.methodBody.hasUnsupportedCallbacks(params),
        );
        this.ctx.usesRef = supportedFunctions.some((f) => this.methodBody.hasRefParameter(f.parameters));
        this.ctx.usesCall = supportedFunctions.length > 0;
        return supportedFunctions;
    }

    /**
     * Builds a variable statement structure for a function.
     */
    private buildFunctionStructure(func: NormalizedFunction): VariableStatementStructure {
        const funcName = toValidIdentifier(toCamelCase(func.name));
        const params = this.methodBody.buildParameterList(func.parameters);
        const returnTypeMapping = this.ffiMapper.mapType(func.returnType, true);
        this.ctx.addTypeImports(returnTypeMapping.imports);

        const fullReturnType = formatNullableReturn(returnTypeMapping.ts, func.returnType.nullable === true);

        const arrowFunc: WriterFunction = (writer) => {
            writer.write("(");
            params.forEach((p, i) => {
                if (i > 0) writer.write(", ");
                const questionMark = p.hasQuestionToken ? "?" : "";
                writer.write(`${p.name}${questionMark}: ${p.type}`);
            });
            writer.write(")");

            if (fullReturnType !== "void") {
                writer.write(`: ${fullReturnType}`);
            }

            writer.write(" => ");
            writer.block(() => {
                this.methodBody.writeFunctionBody(func, returnTypeMapping, {
                    sharedLibrary: this.options.sharedLibrary,
                })(writer);
            });
        };

        return {
            kind: StructureKind.VariableStatement,
            isExported: true,
            declarationKind: VariableDeclarationKind.Const,
            docs: buildJsDocStructure(func.doc, this.options.namespace),
            declarations: [
                {
                    kind: StructureKind.VariableDeclaration,
                    name: funcName,
                    initializer: arrowFunc,
                },
            ],
        };
    }
}
