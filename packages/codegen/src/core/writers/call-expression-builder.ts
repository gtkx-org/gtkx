/**
 * Call Expression Builder
 *
 * Builds FFI call expressions for code generation. When a per-file
 * {@link FfiDescriptorRegistry} is supplied, hoists each call's descriptor
 * into a single `fn(...)` declaration and emits a curried call site;
 * otherwise (or for variadic callables) falls back to an inline `call(...)`
 * expression. Uses our Writer for streaming code output.
 */

import type { Writer } from "../../builders/writer.js";
import type { FfiTypeDescriptor, MappedType } from "../type-system/ffi-types.js";
import type { FfiDescriptorRegistry } from "./descriptor-registry.js";
import { writeFfiTypeExpression } from "./ffi-type-expression.js";

/**
 * Whether a value of `ffiTypeName` requires unwrapping to its native `.handle` pointer
 * when passed across the FFI boundary (rather than being marshaled as a primitive).
 */
export const isHandleBackedType = (ffiTypeName: string | undefined): boolean =>
    ffiTypeName === "gobject" || ffiTypeName === "boxed" || ffiTypeName === "struct" || ffiTypeName === "fundamental";

/**
 * Minimal interface satisfied by {@link FileBuilder}-style import collectors.
 * Re-declared here to avoid pulling in a heavier dependency just for the type.
 */
type ImportSink = {
    addImport(specifier: string, names: string[]): void;
};

/**
 * Callback wrapper info for generating wrapped callback arguments.
 */
export type CallbackWrapperInfo = {
    paramName: string;
    wrappedName: string;
    wrapExpression: (writer: Writer) => void;
    isOptional: boolean;
};

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
    /** Callback wrapper info if this is a callback that needs wrapping */
    callbackWrapper?: CallbackWrapperInfo;
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
    /** Whether this function has varargs (spreads ...args at the end) */
    hasVarargs?: boolean;
};

/**
 * Builds FFI call() expressions.
 *
 * Uses our Writer for streaming code output.
 *
 * @example
 * ```typescript
 * const builder = new CallExpressionBuilder();
 *
 * const writerFn = builder.toWriter({
 *   sharedLibrary: "libgtk-4.so.1",
 *   cIdentifier: "gtk_button_set_label",
 *   args: [{ type: { type: "string" }, value: "label" }],
 *   returnType: { type: "void" },
 *   selfArg: { type: { type: "gobject" }, value: "this.handle" },
 * });
 * writerFn(writer);
 * ```
 */
export class CallExpressionBuilder {
    constructor(
        private readonly registry?: FfiDescriptorRegistry,
        private readonly imports?: ImportSink,
    ) {}

    /**
     * Builds a call expression as a writer function.
     *
     * If a registry was supplied and the call is non-variadic, the descriptor
     * is hoisted to a `fn(...)` const and the emitted expression is a curried
     * invocation `<binding>(value1, value2, ...)`. Otherwise (no registry, or
     * a variadic callable that cannot be curried) emits the inline
     * `call("lib", "sym", [...], returnType)` form.
     *
     * @param options - Call expression options
     * @returns Function that writes the call expression to a Writer
     */
    toWriter(options: CallExpressionOptions): (writer: Writer) => void {
        const binding = this.registry?.register(options);

        if (binding?.varargs === false) {
            this.imports?.addImport("../../native.js", ["t"]);
            return this.curriedWriter(options, binding.name);
        }

        this.imports?.addImport("../../native.js", ["call", "t"]);
        return this.inlineWriter(options);
    }

    private curriedWriter(options: CallExpressionOptions, bindingName: string): (writer: Writer) => void {
        const allArgs = this.collectArguments(options);
        return (writer) => {
            writer.write(`${bindingName}(`);
            for (let i = 0; i < allArgs.length; i++) {
                if (i > 0) writer.write(", ");
                writer.write(allArgs[i]?.value ?? "undefined");
            }
            writer.write(")");
        };
    }

    private writeCallArguments(
        writer: Writer,
        options: CallExpressionOptions,
        allArgs: Array<{ type: FfiTypeDescriptor; value: string; optional?: boolean }>,
    ): void {
        allArgs.forEach((arg, index) => {
            this.writeArgument(writer, arg);
            if (index < allArgs.length - 1 || options.hasVarargs) {
                writer.write(",");
            }
            writer.newLine();
        });
        if (options.hasVarargs) {
            writer.writeLine("...args,");
        }
    }

    private inlineWriter(options: CallExpressionOptions): (writer: Writer) => void {
        return (writer) => {
            writer.write("call(");
            writer.newLine();
            writer.withIndent(() => {
                writer.writeLine(`"${options.sharedLibrary}",`);
                writer.writeLine(`"${options.cIdentifier}",`);
                writer.write("[");
                const allArgs = this.collectArguments(options);
                const hasContent = allArgs.length > 0 || options.hasVarargs;
                if (hasContent) {
                    writer.newLine();
                    writer.withIndent(() => this.writeCallArguments(writer, options, allArgs));
                }
                writer.writeLine("],");
                writeFfiTypeExpression(writer, options.returnType);
                writer.newLine();
            });
            writer.write(")");
        };
    }

    /**
     * Builds a value expression that handles object ID extraction.
     *
     * For gobject/boxed/struct types, extracts the `.handle` property (NativeHandle).
     * For arrays of gobject/boxed/struct types, maps each item to its `.handle`.
     * For hashtable types, generates: `Array.from(value)` to convert Map to array of tuples.
     * For primitives, just returns the value name.
     */
    private buildHandleAccessExpression(valueName: string, mappedType: MappedType, nullable: boolean): string {
        const isUnknownType = mappedType.ts === "unknown";
        if (isUnknownType) {
            return nullable
                ? `(${valueName} as { handle: NativeHandle } | null)?.handle`
                : `(${valueName} as { handle: NativeHandle }).handle`;
        }
        return nullable ? `${valueName}?.handle` : `${valueName}.handle`;
    }

    private buildHashTableExpression(valueName: string, mappedType: MappedType): string {
        if (isHandleBackedType(mappedType.ffi.valueType?.type)) {
            return `${valueName} ? Array.from(${valueName}).map(([k, v]) => [k, v?.handle]) : null`;
        }
        return `${valueName} ? Array.from(${valueName}) : null`;
    }

    buildValueExpression(valueName: string, mappedType: MappedType, nullable = false): string {
        const needsPtr =
            mappedType.ffi.type === "gobject" ||
            mappedType.ffi.type === "boxed" ||
            mappedType.ffi.type === "struct" ||
            mappedType.ffi.type === "fundamental";

        if (needsPtr) {
            return this.buildHandleAccessExpression(valueName, mappedType, nullable);
        }

        if (
            mappedType.ffi.type === "array" &&
            mappedType.ffi.itemType &&
            isHandleBackedType(mappedType.ffi.itemType.type)
        ) {
            return nullable ? `${valueName}?.map(item => item.handle)` : `${valueName}.map(item => item.handle)`;
        }

        if (mappedType.ffi.type === "hashtable") {
            return this.buildHashTableExpression(valueName, mappedType);
        }

        return valueName;
    }

    /**
     * Builds error checking code as a writer function.
     *
     * @param gerrorRef - The GError class reference (e.g., "GLib.GError" or "GError")
     */
    errorCheckWriter(gerrorRef = "GLib.GError"): (writer: Writer) => void {
        return (writer) => {
            writer.writeLine("if (error.value !== null) {");
            writer.withIndent(() => {
                writer.writeLine(`throw new NativeError(getNativeObject(error.value as NativeHandle, ${gerrorRef}));`);
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

    private writeArgument(writer: Writer, arg: { type: FfiTypeDescriptor; value: string; optional?: boolean }): void {
        writer.write("{");
        writer.newLine();
        writer.withIndent(() => {
            writer.write("type: ");
            writeFfiTypeExpression(writer, arg.type);
            writer.write(",");
            writer.newLine();
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
