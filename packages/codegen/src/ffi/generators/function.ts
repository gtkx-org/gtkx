/**
 * Function Generator
 *
 * Generates standalone exported functions using the builder library.
 */

import { type FileBuilder, variableStatement, type Writer } from "../../builders/index.js";
import { addTypeImports, createMethodBodyWriter, type MethodBodyWriter } from "../../ffi-emitters/index.js";
import type { FfiGeneratorOptions } from "../../generator-types.js";
import type { GirFunction } from "../../gir/index.js";
import type { FfiMapper } from "../../type-system/ffi-mapper.js";
import { type AsyncCallablePair, collectAsyncCallablePairs } from "../../utils/async-callable.js";
import { formatJsDoc } from "../../utils/doc-formatter.js";
import { hasVarargs, partitionSupportedFunctions } from "../../utils/filtering.js";
import { jsStringLiteral } from "../../utils/js-literal.js";
import { toCamelCase, toValidExportName } from "../../utils/naming.js";

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
        const visible = functions.filter((func) => func.shadowedBy === undefined);
        const { supported, unsupported } = partitionSupportedFunctions(
            visible,
            (params) => this.methodBody.hasUnsupportedCallbacks(params),
            (returnType) => this.methodBody.isReturnTypeUnsafe(returnType),
        );

        if (supported.length > 0) {
            this.file.addImport("../../runtime.js", ["getHandle", "tryGetHandle"]);
        }

        const asyncPairs = collectAsyncCallablePairs(supported, functions);

        for (const func of supported) {
            const pair = asyncPairs.get(func.name);
            if (pair) {
                this.addAsyncFunction(pair);
            } else {
                this.addFunction(func);
            }
        }
        for (const func of unsupported) {
            this.addFunctionStub(func);
        }

        return functions.length > 0;
    }

    private addAsyncFunction(pair: AsyncCallablePair<GirFunction, GirFunction>): void {
        const structure = this.methodBody.buildAsyncCallableStructure({
            asyncCallable: pair.async,
            finishCallable: pair.finish,
            callbackParameter: pair.callbackParameter,
            memberName: toValidExportName(toCamelCase(pair.async.name)),
            finishMemberName: toValidExportName(toCamelCase(pair.finish.name)),
            isStatic: false,
            sharedLibrary: this.options.sharedLibrary,
            namespace: this.options.namespace,
        });

        const initializer = (writer: Writer) => {
            writer.write("(");
            structure.parameters.forEach((p, i) => {
                if (i > 0) writer.write(", ");
                if (p.isRestParameter) writer.write("...");
                writer.write(p.name);
            });
            writer.write(") => ");
            writer.writeBlock(() => {
                structure.statements(writer);
            });
        };

        this.file.add(
            variableStatement(structure.name, {
                exported: true,
                initializer,
                doc: formatJsDoc(pair.async.doc, this.options.namespace),
            }),
        );
    }

    private addFunction(func: GirFunction): void {
        const funcName = toValidExportName(toCamelCase(func.name));
        const shape = this.methodBody.buildShape(func.parameters, func.returnType, 0);
        const params = this.methodBody.buildSignatureParameters(shape, hasVarargs(func.parameters));
        addTypeImports(this.file, shape.returnTypeMapping.imports);

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
            }
            writer.write(") => ");
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

    /**
     * Emits a throwing stub for a function whose signature the FFI layer
     * cannot marshal.
     *
     * node-gtk exposes every namespace function as a property, so the stub
     * keeps the runtime surface in step with the declared contract and
     * replaces a silent `undefined` with a descriptive error at call time.
     */
    private addFunctionStub(func: GirFunction): void {
        const funcName = toValidExportName(toCamelCase(func.name));
        const message = `${this.options.namespace}.${func.name} is not callable through the @gtkx/ffi runtime`;
        this.file.add(
            variableStatement(funcName, {
                exported: true,
                initializer: (writer: Writer) => {
                    writer.write(`() => { throw new Error(${jsStringLiteral(message)}); }`);
                },
                doc: formatJsDoc(func.doc, this.options.namespace),
            }),
        );
    }
}
