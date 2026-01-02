/**
 * Call Expression Builder
 *
 * Builds FFI call() expressions for code generation.
 * Uses ts-morph WriterFunction for optimal AST construction.
 */

import { type WriterFunction, Writers } from "ts-morph";
import type { FfiTypeDescriptor, MappedType } from "../type-system/ffi-types.js";
import { FfiTypeWriter } from "./ffi-type-writer.js";

/**
 * Represents a single argument to a call() expression.
 */
export type CallArgument = {
    /** The FFI type descriptor for this argument */
    type: FfiTypeDescriptor;
    /** The value expression (JavaScript code) */
    value: string;
    /** Whether this argument is optional */
    optional?: boolean;
};

/**
 * Options for building a call expression.
 */
export type CallExpressionOptions = {
    /** The shared library (e.g., "libgtk-4.so.1") */
    sharedLibrary: string;
    /** The C identifier (e.g., "gtk_button_new") */
    cIdentifier: string;
    /** Arguments to pass to the function */
    args: CallArgument[];
    /** Return type descriptor */
    returnType: FfiTypeDescriptor;
    /** Self argument to prepend (for instance methods) */
    selfArg?: {
        type: FfiTypeDescriptor;
        value: string;
    };
};

/**
 * Builds FFI call() expressions.
 *
 * Uses ts-morph WriterFunction for optimal AST construction.
 *
 * @example
 * ```typescript
 * const builder = new CallExpressionBuilder();
 *
 * // ts-morph WriterFunction
 * const writer = builder.toWriter({
 *   sharedLibrary: "libgtk-4.so.1",
 *   cIdentifier: "gtk_button_set_label",
 *   args: [{ type: { type: "string" }, value: "label" }],
 *   returnType: { type: "undefined" },
 *   selfArg: { type: { type: "gobject" }, value: "this.id" },
 * });
 * ```
 */
export class CallExpressionBuilder {
    private ffiTypeWriter: FfiTypeWriter;

    constructor(ffiTypeWriter?: FfiTypeWriter) {
        this.ffiTypeWriter = ffiTypeWriter ?? new FfiTypeWriter();
    }

    /**
     * Builds a call expression as a ts-morph WriterFunction.
     *
     * @param options - Call expression options
     * @returns WriterFunction that writes the call expression
     */
    toWriter(options: CallExpressionOptions): WriterFunction {
        return (writer) => {
            writer.write("call(");
            writer.newLine();
            writer.indent(() => {
                writer.writeLine(`"${options.sharedLibrary}",`);
                writer.writeLine(`"${options.cIdentifier}",`);
                writer.write("[");
                const allArgs = this.collectArguments(options);
                if (allArgs.length > 0) {
                    writer.newLine();
                    writer.indent(() => {
                        allArgs.forEach((arg, index) => {
                            this.writeArgument(writer, arg);
                            if (index < allArgs.length - 1) {
                                writer.write(",");
                            }
                            writer.newLine();
                        });
                    });
                }
                writer.writeLine("],");
                this.ffiTypeWriter.toWriter(options.returnType)(writer);
                writer.newLine();
            });
            writer.write(")");
        };
    }

    /**
     * Builds a value expression that handles object ID extraction.
     *
     * For gobject/boxed/struct types, generates: `(value as any)?.id ?? value`
     * For primitives, just returns the value name.
     */
    buildValueExpression(valueName: string, mappedType: MappedType): string {
        const needsPtr =
            mappedType.ffi.type === "gobject" || mappedType.ffi.type === "boxed" || mappedType.ffi.type === "struct";

        if (needsPtr) {
            return `(${valueName} as any)?.id ?? ${valueName}`;
        }

        return valueName;
    }

    /**
     * Builds an error argument as WriterFunction.
     */
    errorArgumentWriter(): WriterFunction {
        return Writers.object({
            type: this.ffiTypeWriter.errorArgumentWriter(),
            value: "error",
        });
    }

    /**
     * Builds error checking code as WriterFunction.
     */
    errorCheckWriter(): WriterFunction {
        return (writer) => {
            writer.writeLine("if (error.value !== null) {");
            writer.indent(() => {
                writer.writeLine("throw new NativeError(error.value);");
            });
            writer.writeLine("}");
        };
    }

    private collectArguments(
        options: CallExpressionOptions,
    ): Array<{ type: FfiTypeDescriptor; value: string; optional?: boolean }> {
        const allArgs: Array<{ type: FfiTypeDescriptor; value: string; optional?: boolean }> = [];

        if (options.selfArg) {
            allArgs.push({
                type: options.selfArg.type,
                value: options.selfArg.value,
            });
        }

        for (const arg of options.args) {
            allArgs.push(arg);
        }

        return allArgs;
    }

    /**
     * Writes a single argument using ts-morph writer.
     */
    private writeArgument(
        writer: ReturnType<typeof Writers.object> extends (w: infer W) => void ? W : never,
        arg: { type: FfiTypeDescriptor; value: string; optional?: boolean },
    ): void {
        writer.write("{");
        writer.newLine();
        writer.indent(() => {
            writer.write("type: ");
            this.ffiTypeWriter.toWriter(arg.type)(writer as never);
            writer.writeLine(",");
            writer.write(`value: ${arg.value}`);
            if (arg.optional) {
                writer.writeLine(",");
                writer.write("optional: true");
            }
            writer.newLine();
        });
        writer.write("}");
    }
}
