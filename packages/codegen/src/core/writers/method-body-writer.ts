/**
 * Method Body Builder
 *
 * Shared utilities for building method/function bodies.
 * Extracts common patterns from RecordGenerator, InterfaceGenerator, ClassGenerator.
 */

import type { NormalizedConstructor, NormalizedFunction, NormalizedMethod, NormalizedParameter } from "@gtkx/gir";
import type { MethodDeclarationStructure, WriterFunction } from "ts-morph";
import { StructureKind } from "ts-morph";
import type { GenerationContext } from "../generation-context.js";
import type { FfiMapper } from "../type-system/ffi-mapper.js";
import type { FfiTypeDescriptor, MappedType, SelfTypeDescriptor } from "../type-system/ffi-types.js";
import { buildJsDocStructure } from "../utils/doc-formatter.js";
import { toCamelCase, toValidIdentifier } from "../utils/naming.js";
import { formatNullableReturn } from "../utils/type-qualification.js";
import { type CallArgument, CallExpressionBuilder } from "./call-expression-builder.js";
import { FfiTypeWriter } from "./ffi-type-writer.js";

/**
 * Information about a Ref parameter that GTK allocates.
 */
export type GtkAllocatedRef = {
    paramName: string;
    innerType: string;
    nullable: boolean;
    isBoxed: boolean;
    boxedTypeName: string | undefined;
};

/**
 * Options for building instance method body statements.
 */
export type MethodBodyStatementsOptions = {
    /** The shared library (e.g., "libgtk-4.so.1") */
    sharedLibrary: string;
    /** Self type descriptor for FFI marshalling */
    selfTypeDescriptor: SelfTypeDescriptor;
    /** Class name for object wrapping (e.g., "GtkButton") */
    className?: string;
};

/**
 * Options for building function body statements.
 */
export type FunctionBodyStatementsOptions = {
    /** The shared library (e.g., "libgtk-4.so.1") */
    sharedLibrary: string;
    /** Class name for own-class returns */
    className?: string;
    /** Whether the function returns its own class type */
    returnsOwnClass?: boolean;
};

/**
 * Unified options for callable body generation.
 * Used internally by writeCallableBody to handle both methods and functions.
 */
type CallableBodyOptions = {
    /** The shared library (e.g., "libgtk-4.so.1") */
    sharedLibrary: string;
    /** C identifier for the FFI call */
    cIdentifier: string;
    /** Parameters for the callable */
    parameters: readonly NormalizedParameter[];
    /** Return type info */
    returnType: { nullable?: boolean };
    /** Mapped return type info */
    returnTypeMapping: MappedType;
    /** Whether the callable can throw */
    throws?: boolean;
    /** Self options for instance methods */
    self?: { type: SelfTypeDescriptor; value: string };
    /** Class name for own-class returns (static functions on records) */
    ownClassName?: string;
};

/**
 * Options for building a complete method structure.
 */
export type MethodStructureOptions = {
    /** The method name to use (after any renaming) */
    methodName: string;
    /** Self type descriptor for FFI marshalling */
    selfTypeDescriptor: SelfTypeDescriptor;
    /** The shared library (e.g., "libgtk-4.so.1") */
    sharedLibrary: string;
    /** Current namespace for documentation links */
    namespace: string;
    /** Class name for object wrapping (boxed types) */
    className?: string;
};

export type StaticFunctionStructureOptions = {
    /** The normalized TypeScript class name (e.g., "TextIter", "Button") */
    className: string;
    /** The original GIR class/record name for return type comparison */
    originalClassName: string;
    /** The shared library (e.g., "libgtk-4.so.1") */
    sharedLibrary: string;
    /** Current namespace for documentation links */
    namespace: string;
};

/**
 * Result of constructor selection analysis.
 */
export type ConstructorSelection = {
    /** Constructors that don't have unsupported callbacks */
    supported: NormalizedConstructor[];
    /** The main constructor (first non-vararg supported constructor) */
    main: NormalizedConstructor | undefined;
};

/**
 * Shared utilities for writing method/function bodies.
 *
 * Centralizes common patterns used across generators:
 * - Parameter filtering and validation
 * - Call argument generation (via buildCallArgumentsArray)
 * - Ref parameter handling
 * - Return value wrapping decisions
 *
 * @example
 * ```typescript
 * const writer = new MethodBodyWriter(ffiMapper, ctx);
 *
 * // Check parameter requirements
 * if (writer.hasUnsupportedCallbacks(params)) return;
 *
 * // Generate method body using ts-morph WriterFunction
 * classDecl.addMethod({
 *   name: "myMethod",
 *   parameters: writer.buildParameterList(method.parameters),
 *   statements: writer.writeMethodBody(method, returnTypeMapping, options),
 * });
 * ```
 */
export class MethodBodyWriter {
    private ffiTypeWriter: FfiTypeWriter;
    private callExpression: CallExpressionBuilder;

    constructor(
        private readonly ffiMapper: FfiMapper,
        private readonly ctx: GenerationContext,
        ffiTypeWriter?: FfiTypeWriter,
    ) {
        this.ffiTypeWriter = ffiTypeWriter ?? new FfiTypeWriter();
        this.callExpression = new CallExpressionBuilder(this.ffiTypeWriter);
    }

    /**
     * Checks if a parameter is varargs.
     */
    isVararg(param: NormalizedParameter): boolean {
        return param.name === "..." || param.name === "";
    }

    /**
     * Filters parameters to get only the ones that should be in the function signature.
     * Removes varargs and closure target parameters.
     */
    filterParameters(parameters: readonly NormalizedParameter[]): NormalizedParameter[] {
        return parameters.filter((p) => !this.isVararg(p) && !this.ffiMapper.isClosureTarget(p, parameters));
    }

    /**
     * Checks if any parameter is a Ref type.
     */
    hasRefParameter(params: readonly NormalizedParameter[]): boolean {
        return params.some((p) => this.ffiMapper.mapParameter(p).ts.startsWith("Ref<"));
    }

    /**
     * Checks if any parameter has an unsupported callback type.
     */
    hasUnsupportedCallbacks(params: readonly NormalizedParameter[]): boolean {
        return params.some((p) => this.ffiMapper.hasUnsupportedCallback(p));
    }

    /**
     * Selects supported constructors and identifies the main constructor.
     *
     * Filters out constructors with unsupported callbacks and identifies
     * the "main" constructor as the first non-vararg constructor.
     *
     * @param constructors - The constructors to analyze
     * @returns Object with supported constructors and the main constructor (if any)
     *
     * @example
     * ```typescript
     * const { supported, main } = builder.selectConstructors(cls.constructors);
     * if (main) {
     *   // Use main constructor for class constructor
     * }
     * for (const ctor of supported) {
     *   if (ctor !== main) {
     *     // Generate static factory method
     *   }
     * }
     * ```
     */
    selectConstructors(constructors: readonly NormalizedConstructor[]): ConstructorSelection {
        const supported = constructors.filter((c) => !this.hasUnsupportedCallbacks(c.parameters));
        const main = supported.find((c) => !c.parameters.some((p) => this.isVararg(p)));
        return { supported, main };
    }

    /**
     * Converts a parameter name to a valid JavaScript identifier.
     */
    toJsParamName(param: NormalizedParameter): string {
        return toValidIdentifier(toCamelCase(param.name));
    }

    /**
     * Identifies Ref parameters where GTK allocates the referenced object.
     * These need to be rewrapped after the call.
     */
    identifyGtkAllocatedRefs(parameters: readonly NormalizedParameter[]): GtkAllocatedRef[] {
        const filtered = this.filterParameters(parameters);

        return filtered
            .map((param) => {
                const mapped = this.ffiMapper.mapParameter(param);
                if (
                    mapped.ffi.type === "ref" &&
                    typeof mapped.ffi.innerType === "object" &&
                    (mapped.ffi.innerType.type === "boxed" || mapped.ffi.innerType.type === "gobject") &&
                    mapped.innerTsType
                ) {
                    const isBoxed = mapped.ffi.innerType.type === "boxed";
                    const boxedTypeName = isBoxed
                        ? (mapped.ffi.innerType as { innerType?: string }).innerType
                        : undefined;
                    return {
                        paramName: this.toJsParamName(param),
                        innerType: mapped.innerTsType,
                        nullable: this.ffiMapper.isNullable(param),
                        isBoxed,
                        boxedTypeName,
                    };
                }
                return null;
            })
            .filter((x): x is GtkAllocatedRef => x !== null);
    }

    /**
     * Determines if a return type needs object wrapping (getNativeObject call).
     */
    needsObjectWrap(returnTypeMapping: MappedType): {
        needsWrap: boolean;
        needsGObjectWrap: boolean;
        needsBoxedWrap: boolean;
        needsGVariantWrap: boolean;
        needsInterfaceWrap: boolean;
        needsArrayItemWrap: boolean;
        arrayItemType: string | undefined;
    } {
        const baseReturnType = returnTypeMapping.ts === "void" ? "void" : returnTypeMapping.ts;

        const needsGObjectWrap =
            returnTypeMapping.ffi.type === "gobject" &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind !== "interface";

        const needsBoxedWrap =
            returnTypeMapping.ffi.type === "boxed" &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind !== "interface";

        const needsGVariantWrap = returnTypeMapping.ffi.type === "gvariant" && baseReturnType !== "unknown";

        const needsInterfaceWrap =
            returnTypeMapping.ffi.type === "gobject" &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind === "interface";

        const itemType = returnTypeMapping.ffi.itemType;
        const needsArrayItemWrap =
            returnTypeMapping.ffi.type === "array" &&
            itemType !== undefined &&
            (itemType.type === "gobject" || itemType.type === "boxed" || itemType.type === "gvariant");

        const arrayItemType = needsArrayItemWrap ? baseReturnType.replace(/\[\]$/, "") : undefined;

        return {
            needsWrap: needsGObjectWrap || needsBoxedWrap || needsGVariantWrap || needsInterfaceWrap,
            needsGObjectWrap,
            needsBoxedWrap,
            needsGVariantWrap,
            needsInterfaceWrap,
            needsArrayItemWrap,
            arrayItemType,
        };
    }

    /**
     * Generates a unique result variable name.
     * Avoids collision with a parameter named "result".
     */
    getResultVarName(parameters: readonly NormalizedParameter[]): string {
        const hasResultParam = parameters.some((p) => this.toJsParamName(p) === "result");
        return hasResultParam ? "_result" : "result";
    }

    /**
     * Builds a parameter list for ts-morph method declarations.
     *
     * @param parameters - The normalized parameters
     * @returns Array of parameter structures for ts-morph
     *
     * @example
     * ```typescript
     * const params = builder.buildParameterList(method.parameters);
     * classDecl.addMethod({
     *   name: "myMethod",
     *   parameters: params,
     * });
     * ```
     */
    buildParameterList(
        parameters: readonly NormalizedParameter[],
    ): Array<{ name: string; type: string; hasQuestionToken?: boolean }> {
        const filteredParams = this.filterParameters(parameters);

        let sawOptional = false;

        return filteredParams.map((param) => {
            const mapped = this.ffiMapper.mapParameter(param);
            this.ctx.addTypeImports(mapped.imports);
            if (mapped.ffi.type === "ref") {
                this.ctx.usesRef = true;
            }

            const paramName = this.toJsParamName(param);
            const isOptional = this.ffiMapper.isNullable(param) || sawOptional;

            if (isOptional) {
                sawOptional = true;
            }

            return {
                name: paramName,
                type: isOptional ? `${mapped.ts} | null` : mapped.ts,
                hasQuestionToken: isOptional,
            };
        });
    }

    /**
     * Builds a complete MethodDeclarationStructure for ts-morph.
     *
     * Consolidates the common pattern used across RecordGenerator, InterfaceGenerator,
     * and MethodBuilder for building method structures.
     *
     * @param method - The normalized method definition
     * @param options - Configuration options
     * @returns MethodDeclarationStructure for ts-morph
     *
     * @example
     * ```typescript
     * const structure = builder.buildMethodStructure(method, {
     *   methodName: "onClick",
     *   selfTypeDescriptor: '{ type: "gobject", ownership: "none" }',
     *   sharedLibrary: "libgtk-4.so.1",
     *   namespace: "Gtk",
     * });
     * classDecl.addMethod(structure);
     * ```
     */
    buildMethodStructure(method: NormalizedMethod, options: MethodStructureOptions): MethodDeclarationStructure {
        const params = this.buildParameterList(method.parameters);
        const returnTypeMapping = this.ffiMapper.mapType(method.returnType, true);
        this.ctx.addTypeImports(returnTypeMapping.imports);

        const tsReturnType = formatNullableReturn(returnTypeMapping.ts, method.returnType.nullable === true);

        return {
            kind: StructureKind.Method,
            name: options.methodName,
            parameters: params,
            returnType: tsReturnType === "void" ? undefined : tsReturnType,
            docs: buildJsDocStructure(method.doc, options.namespace),
            statements: this.writeMethodBody(method, returnTypeMapping, {
                sharedLibrary: options.sharedLibrary,
                selfTypeDescriptor: options.selfTypeDescriptor,
                className: options.className,
            }),
        };
    }

    buildStaticFunctionStructure(
        func: NormalizedFunction,
        options: StaticFunctionStructureOptions,
    ): MethodDeclarationStructure {
        const funcName = toValidIdentifier(toCamelCase(func.name));
        const params = this.buildParameterList(func.parameters);
        const returnTypeMapping = this.ffiMapper.mapType(func.returnType, true);
        this.ctx.addTypeImports(returnTypeMapping.imports);

        const returnTypeName = func.returnType.name as string | undefined;
        const returnsOwnClass =
            returnTypeName === options.originalClassName || returnTypeName?.endsWith(`.${options.originalClassName}`);
        const baseReturnType = returnsOwnClass ? options.className : returnTypeMapping.ts;
        const tsReturnType = formatNullableReturn(baseReturnType, func.returnType.nullable === true);

        return {
            kind: StructureKind.Method,
            name: funcName,
            isStatic: true,
            parameters: params,
            returnType: tsReturnType === "void" ? undefined : tsReturnType,
            docs: buildJsDocStructure(func.doc, options.namespace),
            statements: this.writeFunctionBody(func, returnTypeMapping, {
                sharedLibrary: options.sharedLibrary,
                className: options.className,
                returnsOwnClass,
            }),
        };
    }

    /**
     * Builds call arguments as an array of CallArgument objects.
     * Used with CallExpressionBuilder.toWriter() for ts-morph generation.
     */
    buildCallArgumentsArray(parameters: readonly NormalizedParameter[]): CallArgument[] {
        const filtered = this.filterParameters(parameters);

        return filtered.map((param) => {
            const mapped = this.ffiMapper.mapParameter(param);
            const jsParamName = this.toJsParamName(param);
            const valueName = this.callExpression.buildValueExpression(jsParamName, mapped);
            const isOptional = this.ffiMapper.isNullable(param);

            return {
                type: mapped.ffi,
                value: valueName,
                optional: isOptional,
            };
        });
    }

    /**
     * Writes method body using ts-morph WriterFunction.
     *
     * @param method - The normalized method definition
     * @param returnTypeMapping - The mapped return type
     * @param options - Configuration options
     * @returns WriterFunction for ts-morph
     *
     * @example
     * ```typescript
     * classDecl.addMethod({
     *   name: "click",
     *   statements: builder.writeMethodBody(method, returnTypeMapping, options),
     * });
     * ```
     */
    writeMethodBody(
        method: NormalizedMethod,
        returnTypeMapping: MappedType,
        options: MethodBodyStatementsOptions,
    ): WriterFunction {
        return this.writeCallableBody({
            sharedLibrary: options.sharedLibrary,
            cIdentifier: method.cIdentifier,
            parameters: method.parameters,
            returnType: method.returnType,
            returnTypeMapping,
            throws: method.throws,
            self: { type: options.selfTypeDescriptor, value: "this.id" },
        });
    }

    /**
     * Writes function body using ts-morph WriterFunction.
     *
     * @param func - The normalized function definition
     * @param returnTypeMapping - The mapped return type
     * @param options - Configuration options
     * @returns WriterFunction for ts-morph
     *
     * @example
     * ```typescript
     * sourceFile.addFunction({
     *   name: "myFunction",
     *   statements: builder.writeFunctionBody(func, returnTypeMapping, options),
     * });
     * ```
     */
    writeFunctionBody(
        func: NormalizedFunction,
        returnTypeMapping: MappedType,
        options: FunctionBodyStatementsOptions,
    ): WriterFunction {
        return this.writeCallableBody({
            sharedLibrary: options.sharedLibrary,
            cIdentifier: func.cIdentifier,
            parameters: func.parameters,
            returnType: func.returnType,
            returnTypeMapping,
            throws: func.throws,
            ownClassName: options.returnsOwnClass ? options.className : undefined,
        });
    }

    /**
     * Unified callable body writer for both methods and functions.
     * Consolidates the common patterns shared between writeMethodBody and writeFunctionBody.
     */
    private writeCallableBody(options: CallableBodyOptions): WriterFunction {
        return (writer) => {
            const isNullable = options.returnType.nullable === true;
            const rawReturnType = options.returnTypeMapping.ts;
            const baseReturnType = options.ownClassName ?? rawReturnType;
            const tsReturnType = formatNullableReturn(baseReturnType, isNullable);

            const wrapInfo = this.needsObjectWrap(options.returnTypeMapping);
            const hasReturnValue = baseReturnType !== "void";
            const gtkAllocatesRefs = this.identifyGtkAllocatedRefs(options.parameters);
            const resultVarName = this.getResultVarName(options.parameters);

            if (options.throws) {
                writer.writeLine("const error = { value: null as unknown };");
            }

            const args = this.buildCallArgumentsArray(options.parameters);

            if (options.throws) {
                args.push({
                    type: this.ffiTypeWriter.createGErrorRefTypeDescriptor(),
                    value: "error",
                });
            }

            const hasOwnClassReturn = options.ownClassName !== undefined;
            const hasObjectWrapReturn = wrapInfo.needsWrap && hasReturnValue;

            if (hasOwnClassReturn || hasObjectWrapReturn) {
                this.ctx.usesGetNativeObject = true;
                writer.write("const ptr = ");
                this.callExpression.toWriter({
                    sharedLibrary: options.sharedLibrary,
                    cIdentifier: options.cIdentifier,
                    args,
                    returnType: options.returnTypeMapping.ffi,
                    selfArg: options.self,
                })(writer);
                writer.write(";");
                writer.newLine();

                if (options.throws) {
                    this.writeErrorCheck(writer);
                }
                this.writeRefRewrap(writer, gtkAllocatesRefs);

                if (hasOwnClassReturn) {
                    writer.writeLine(`return getNativeObject(ptr, ${options.ownClassName})!;`);
                } else {
                    if (isNullable) {
                        writer.writeLine("if (ptr === null) return null;");
                    }
                    if (wrapInfo.needsBoxedWrap || wrapInfo.needsGVariantWrap || wrapInfo.needsInterfaceWrap) {
                        writer.writeLine(`return getNativeObject(ptr, ${baseReturnType})!;`);
                    } else {
                        writer.writeLine(`return getNativeObject(ptr) as ${baseReturnType};`);
                    }
                }
            } else if (wrapInfo.needsArrayItemWrap && wrapInfo.arrayItemType) {
                this.ctx.usesGetNativeObject = true;

                writer.write("const arr = ");
                this.callExpression.toWriter({
                    sharedLibrary: options.sharedLibrary,
                    cIdentifier: options.cIdentifier,
                    args,
                    returnType: options.returnTypeMapping.ffi,
                    selfArg: options.self,
                })(writer);
                writer.write(" as unknown[];");
                writer.newLine();

                if (options.throws) {
                    this.writeErrorCheck(writer);
                }
                this.writeRefRewrap(writer, gtkAllocatesRefs);

                writer.writeLine(`return arr.map((item) => getNativeObject(item) as ${wrapInfo.arrayItemType});`);
            } else {
                const hasRefRewrap = gtkAllocatesRefs.length > 0;
                const needsResultVar = options.throws || hasRefRewrap;
                const needsCast = rawReturnType !== "void" && rawReturnType !== "unknown";

                if (needsResultVar && hasReturnValue) {
                    writer.write(`const ${resultVarName} = `);
                } else if (hasReturnValue) {
                    writer.write("return ");
                }

                this.callExpression.toWriter({
                    sharedLibrary: options.sharedLibrary,
                    cIdentifier: options.cIdentifier,
                    args,
                    returnType: options.returnTypeMapping.ffi,
                    selfArg: options.self,
                })(writer);

                if (needsCast) {
                    writer.write(` as ${tsReturnType}`);
                }
                writer.write(";");
                writer.newLine();

                if (options.throws) {
                    this.writeErrorCheck(writer);
                }
                this.writeRefRewrap(writer, gtkAllocatesRefs);

                if (needsResultVar && hasReturnValue) {
                    writer.writeLine(`return ${resultVarName};`);
                }
            }
        };
    }

    /**
     * Writes error check using ts-morph writer.
     */
    private writeErrorCheck(writer: Parameters<WriterFunction>[0]): void {
        this.ctx.usesNativeError = true;
        writer.writeLine("if (error.value !== null) {");
        writer.indent(() => {
            writer.writeLine("throw new NativeError(error.value);");
        });
        writer.writeLine("}");
    }

    /**
     * Writes ref parameter rewrap statements using ts-morph writer.
     * Always uses null check because Ref params may be optional due to preceding optional params.
     */
    private writeRefRewrap(writer: Parameters<WriterFunction>[0], refs: GtkAllocatedRef[]): void {
        for (const ref of refs) {
            this.ctx.usesGetNativeObject = true;
            if (ref.isBoxed) {
                writer.writeLine(
                    `if (${ref.paramName}) ${ref.paramName}.value = getNativeObject(${ref.paramName}.value, ${ref.innerType})!;`,
                );
            } else {
                writer.writeLine(
                    `if (${ref.paramName}) ${ref.paramName}.value = getNativeObject(${ref.paramName}.value)! as ${ref.innerType};`,
                );
            }
        }
    }

    /**
     * Writes a static factory method body.
     *
     * Consolidates the common pattern used by ConstructorBuilder (GObject) and
     * RecordGenerator (boxed) for generating static factory methods.
     *
     * @param options - Configuration for the factory method body
     * @returns WriterFunction for ts-morph
     *
     * @example
     * ```typescript
     * // For GObject constructors
     * const body = builder.writeFactoryMethodBody({
     *   sharedLibrary: "libgtk-4.so.1",
     *   cIdentifier: "gtk_button_new_with_label",
     *   args: callArgs,
     *   returnTypeDescriptor: { type: "gobject", ownership: "full" },
     *   wrapClassName: "Button",
     *   throws: false,
     *   useClassInWrap: false,
     * });
     *
     * // For boxed constructors
     * const body = builder.writeFactoryMethodBody({
     *   sharedLibrary: "libgtk-4.so.1",
     *   cIdentifier: "gtk_text_iter_new",
     *   args: callArgs,
     *   returnTypeDescriptor: { type: "boxed", ownership: "none", innerType: "GtkTextIter", lib: "libgtk-4.so.1" },
     *   wrapClassName: "TextIter",
     *   throws: false,
     *   useClassInWrap: true,
     * });
     * ```
     */
    writeFactoryMethodBody(options: {
        sharedLibrary: string;
        cIdentifier: string;
        args: CallArgument[];
        returnTypeDescriptor: FfiTypeDescriptor;
        wrapClassName: string;
        throws: boolean;
        /** If true, pass the class to getNativeObject. Used for boxed types. */
        useClassInWrap: boolean;
    }): WriterFunction {
        const { sharedLibrary, cIdentifier, args, returnTypeDescriptor, wrapClassName, throws, useClassInWrap } =
            options;

        return (writer) => {
            if (throws) {
                writer.writeLine("const error = { value: null as unknown };");
                args.push({
                    type: this.ffiTypeWriter.createGErrorRefTypeDescriptor(),
                    value: "error",
                });
            }

            writer.write("const ptr = call(");
            writer.newLine();
            writer.indent(() => {
                writer.writeLine(`"${sharedLibrary}",`);
                writer.writeLine(`"${cIdentifier}",`);
                writer.writeLine("[");
                writer.indent(() => {
                    for (const arg of args) {
                        writer.write("{ type: ");
                        this.ffiTypeWriter.toWriter(arg.type)(writer);
                        writer.writeLine(`, value: ${arg.value}, optional: ${arg.optional ?? false} },`);
                    }
                });
                writer.writeLine("],");
                this.ffiTypeWriter.toWriter(returnTypeDescriptor)(writer);
                writer.newLine();
            });
            writer.writeLine(");");

            if (throws) {
                this.ctx.usesNativeError = true;
                writer.writeLine("if (error.value !== null) {");
                writer.indent(() => {
                    writer.writeLine("throw new NativeError(error.value);");
                });
                writer.writeLine("}");
            }

            this.ctx.usesGetNativeObject = true;
            if (useClassInWrap) {
                writer.writeLine(`return getNativeObject(ptr, ${wrapClassName})!;`);
            } else {
                writer.writeLine(`return getNativeObject(ptr) as ${wrapClassName};`);
            }
        };
    }

    /**
     * Gets the FfiTypeWriter instance.
     */
    getFfiTypeWriter(): FfiTypeWriter {
        return this.ffiTypeWriter;
    }

    /**
     * Gets the FfiMapper instance.
     */
    getFfiMapper(): FfiMapper {
        return this.ffiMapper;
    }

    /**
     * Gets the GenerationContext instance.
     */
    getContext(): GenerationContext {
        return this.ctx;
    }

    /**
     * Builds a value expression that handles object ID extraction.
     * Delegates to CallExpressionBuilder.buildValueExpression.
     */
    buildValueExpression(valueName: string, mappedType: MappedType): string {
        return this.callExpression.buildValueExpression(valueName, mappedType);
    }
}
