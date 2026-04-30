/**
 * Function Generator
 *
 * Generates standalone exported functions using the builder library.
 */

import type { GirFunction } from "@gtkx/gir";
import { type FileBuilder, variableStatement, type Writer } from "../../builders/index.js";
import type { FfiGeneratorOptions } from "../../core/generator-types.js";
import type { FfiMapper } from "../../core/type-system/ffi-mapper.js";
import { formatJsDoc } from "../../core/utils/doc-formatter.js";
import { filterSupportedFunctions, hasVarargs } from "../../core/utils/filtering.js";
import { toCamelCase, toValidIdentifier } from "../../core/utils/naming.js";
import { addTypeImports, createMethodBodyWriter, type MethodBodyWriter } from "../../core/writers/index.js";

/**
 * Generates standalone exported functions into a FileBuilder.
 *
 * @example
 * ```typescript
 * const generator = new FunctionGenerator(ffiMapper, file, options);
 * generator.generate(functions);
 * ```
 */
export class FunctionGenerator {
    private readonly methodBody: MethodBodyWriter;

    constructor(
        ffiMapper: FfiMapper,
        private readonly file: FileBuilder,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.methodBody = createMethodBodyWriter(ffiMapper, file, {
            sharedLibrary: options.sharedLibrary,
            glibLibrary: options.glibLibrary,
        });
    }

    /**
     * Generates function declarations and adds them to the file.
     *
     * @param functions - The functions to generate
     * @returns true if any functions were generated
     */
    generate(functions: GirFunction[]): boolean {
        const supported = filterSupportedFunctions(functions, (params) =>
            this.methodBody.hasUnsupportedCallbacks(params),
        );

        for (const func of supported) {
            this.addFunction(func);
        }

        return supported.length > 0;
    }

    private addFunction(func: GirFunction): void {
        const funcName = toValidIdentifier(toCamelCase(func.name));
        const shape = this.methodBody.buildShape(func.parameters, func.returnType, 0);
        const params = this.methodBody.buildSignatureParameters(shape, hasVarargs(func.parameters));
        addTypeImports(this.file, shape.returnTypeMapping.imports);
        const fullReturnType = this.methodBody.computeReturnTypeString(shape, undefined);

        const bodyWriter = this.methodBody.writeFunctionBody(func, shape, {
            sharedLibrary: this.options.sharedLibrary,
        });

        const initializer = (writer: Writer) => {
            writer.write("(");
            for (let i = 0; i < params.length; i++) {
                const p = params[i];
                if (!p) continue;
                if (i > 0) writer.write(", ");
                if (p.isRestParameter) writer.write("...");
                writer.write(p.name);
                if (p.optional) writer.write("?");
                writer.write(`: ${p.type}`);
            }
            writer.write(")");

            if (fullReturnType !== "void") {
                writer.write(`: ${fullReturnType}`);
            }

            writer.write(" => ");
            writer.writeBlock(() => {
                bodyWriter(writer);
            });
        };

        this.file.add(
            variableStatement(funcName, {
                exported: true,
                initializer,
                doc: formatJsDoc(func.doc, this.options.namespace),
            }),
        );
    }
}
