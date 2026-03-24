/**
 * Method Body Builder
 *
 * Shared utilities for building method/function bodies.
 * Extracts common patterns from RecordGenerator, InterfaceGenerator, ClassGenerator.
 */

import type { GirConstructor, GirFunction, GirMethod, GirParameter } from "@gtkx/gir";
import type { Writer } from "../../builders/writer.js";
import type { FfiMapper } from "../type-system/ffi-mapper.js";
import type { FfiTypeDescriptor, MappedType, SelfTypeDescriptor } from "../type-system/ffi-types.js";
import { buildJsDocStructure } from "../utils/doc-formatter.js";
import { hasVarargs, isVararg } from "../utils/filtering.js";
import { createWrappedName, toCamelCase, toKebabCase, toValidIdentifier, toValidMemberName } from "../utils/naming.js";
import { formatNullableReturn } from "../utils/type-qualification.js";
import { type CallArgument, type CallbackWrapperInfo, CallExpressionBuilder } from "./call-expression-builder.js";
import { FfiTypeWriter } from "./ffi-type-writer.js";
import { ParamWrapWriter } from "./param-wrap-writer.js";

/**
 * Collects imports during method body generation.
 * The FileBuilder naturally satisfies this interface.
 */
export type ImportCollector = {
    addImport(specifier: string, names: string[]): void;
    addTypeImport(specifier: string, names: string[]): void;
    addNamespaceImport(specifier: string, alias: string): void;
};

/**
 * Information about a Ref parameter that GTK allocates.
 */
type GtkAllocatedRef = {
    paramName: string;
    innerType: string;
    nullable: boolean;
    isBoxed: boolean;
    isInterface: boolean;
    boxedTypeName: string | undefined;
    isArray: boolean;
    arrayItemType: string | undefined;
    arrayItemIsBoxed: boolean;
    arrayItemIsInterface: boolean;
};

/**
 * Options for building instance method body statements.
 */
type MethodBodyStatementsOptions = {
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
type FunctionBodyStatementsOptions = {
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
    parameters: readonly GirParameter[];
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
    /** Whether this callable has varargs */
    hasVarargs?: boolean;
};

/**
 * Options for building a complete method structure.
 */
type MethodStructureOptions = {
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

type StaticFunctionStructureOptions = {
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
 * Shape returned by buildMethodStructure and buildStaticFunctionStructure.
 * Generators consume this to emit method declarations.
 */
export type MethodStructure = {
    name: string;
    isStatic?: boolean;
    override?: boolean;
    parameters: Array<{ name: string; type: string; optional?: boolean; isRestParameter?: boolean }>;
    returnType: string | undefined;
    docs: Array<{ description: string }> | undefined;
    statements: (writer: Writer) => void;
    overloads?: Array<{
        params: Array<{ name: string; type: string; optional?: boolean; isRestParameter?: boolean }>;
        returnType?: string;
    }>;
};

/**
 * Result of constructor selection analysis.
 */
export type ConstructorSelection = {
    /** Constructors that don't have unsupported callbacks */
    supported: GirConstructor[];
    /** The main constructor (first non-vararg supported constructor) */
    main: GirConstructor | undefined;
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
 * const writer = new MethodBodyWriter(ffiMapper, imports);
 *
 * if (writer.hasUnsupportedCallbacks(params)) return;
 *
 * const structure = writer.buildMethodStructure(method, options);
 * ```
 */
export class MethodBodyWriter {
    private ffiTypeWriter: FfiTypeWriter;
    private callExpression: CallExpressionBuilder;
    private paramWrapWriter: ParamWrapWriter;
    private selfNames: ReadonlySet<string> = new Set();

    constructor(
        private readonly ffiMapper: FfiMapper,
        private readonly imports: ImportCollector,
        ffiTypeWriter?: FfiTypeWriter,
    ) {
        this.ffiTypeWriter = ffiTypeWriter ?? new FfiTypeWriter();
        this.callExpression = new CallExpressionBuilder();
        this.paramWrapWriter = new ParamWrapWriter();
    }

    /**
     * Sets names that should be excluded from type imports.
     * Use this to prevent a class from importing itself.
     */
    setSelfNames(names: ReadonlySet<string>): void {
        this.selfNames = names;
    }

    /**
     * Filters parameters to get only the ones that should be in the function signature.
     * Removes varargs and closure target parameters.
     */
    filterParameters(parameters: readonly GirParameter[]): GirParameter[] {
        return parameters.filter((p) => !isVararg(p) && !this.ffiMapper.isClosureTarget(p, parameters));
    }

    /**
     * Checks if any parameter is a Ref type.
     */
    hasRefParameter(params: readonly GirParameter[]): boolean {
        return params.some((p) => this.ffiMapper.mapParameter(p).ts.startsWith("Ref<"));
    }

    /**
     * Checks if any parameter has an unsupported callback type.
     */
    hasUnsupportedCallbacks(params: readonly GirParameter[]): boolean {
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
    selectConstructors(constructors: readonly GirConstructor[]): ConstructorSelection {
        const supported = constructors.filter((c) => !c.shadowedBy && !this.hasUnsupportedCallbacks(c.parameters));
        const main = supported.find((c) => !c.parameters.some(isVararg));
        return { supported, main };
    }

    /**
     * Converts a parameter name to a valid JavaScript identifier.
     */
    toJsParamName(param: GirParameter): string {
        return toValidIdentifier(toCamelCase(param.name));
    }

    /**
     * Resolves the method name, applying any dynamic renames.
     */
    resolveMethodName(method: GirMethod, methodRenames: Map<string, string>): string {
        const dynamicRename = methodRenames.get(method.cIdentifier);
        const camelName = toCamelCase(method.name);
        return dynamicRename ?? camelName;
    }

    /**
     * Identifies Ref parameters where GTK allocates the referenced object.
     * These need to be rewrapped after the call.
     */
    identifyGtkAllocatedRefs(parameters: readonly GirParameter[]): GtkAllocatedRef[] {
        const filtered = this.filterParameters(parameters);

        return filtered
            .map((param): GtkAllocatedRef | null => {
                const mapped = this.ffiMapper.mapParameter(param);
                if (mapped.ffi.type !== "ref" || typeof mapped.ffi.innerType !== "object" || !mapped.innerTsType) {
                    return null;
                }

                const innerFfi = mapped.ffi.innerType;

                if (innerFfi.type === "boxed" || innerFfi.type === "gobject" || innerFfi.type === "fundamental") {
                    const isBoxed = innerFfi.type === "boxed";
                    const isInterface = mapped.kind === "interface";
                    const boxedTypeName = isBoxed ? (innerFfi as { innerType?: string }).innerType : undefined;
                    return {
                        paramName: this.toJsParamName(param),
                        innerType: mapped.innerTsType,
                        nullable: this.ffiMapper.isNullable(param),
                        isBoxed,
                        isInterface,
                        boxedTypeName,
                        isArray: false,
                        arrayItemType: undefined,
                        arrayItemIsBoxed: false,
                        arrayItemIsInterface: false,
                    };
                }

                if (
                    innerFfi.type === "array" &&
                    innerFfi.itemType &&
                    (innerFfi.itemType.type === "gobject" ||
                        innerFfi.itemType.type === "boxed" ||
                        innerFfi.itemType.type === "fundamental")
                ) {
                    const arrayItemType = mapped.innerTsType.replace(/\[\]$/, "");
                    const arrayItemIsBoxed = innerFfi.itemType.type === "boxed";
                    const arrayItemIsInterface = mapped.itemKind === "interface";
                    return {
                        paramName: this.toJsParamName(param),
                        innerType: mapped.innerTsType,
                        nullable: this.ffiMapper.isNullable(param),
                        isBoxed: false,
                        isInterface: false,
                        boxedTypeName: undefined,
                        isArray: true,
                        arrayItemType,
                        arrayItemIsBoxed,
                        arrayItemIsInterface,
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
        needsFundamentalWrap: boolean;
        needsInterfaceWrap: boolean;
        needsStructWrap: boolean;
        needsArrayItemWrap: boolean;
        arrayItemType: string | undefined;
        arrayItemIsInterface: boolean;
        needsHashTableWrap: boolean;
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

        const needsFundamentalWrap =
            returnTypeMapping.ffi.type === "fundamental" &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind !== "interface";

        const needsInterfaceWrap =
            (returnTypeMapping.ffi.type === "gobject" || returnTypeMapping.ffi.type === "fundamental") &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind === "interface";

        const needsStructWrap =
            returnTypeMapping.ffi.type === "struct" &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind !== "interface";

        const itemType = returnTypeMapping.ffi.itemType;
        const needsArrayItemWrap =
            returnTypeMapping.ffi.type === "array" &&
            itemType !== undefined &&
            (itemType.type === "gobject" || itemType.type === "boxed" || itemType.type === "fundamental");

        const arrayItemType = needsArrayItemWrap ? baseReturnType.replace(/\[\]$/, "") : undefined;
        const arrayItemIsInterface = returnTypeMapping.itemKind === "interface";

        const needsHashTableWrap = returnTypeMapping.ffi.type === "hashtable";

        return {
            needsWrap:
                needsGObjectWrap || needsBoxedWrap || needsFundamentalWrap || needsInterfaceWrap || needsStructWrap,
            needsGObjectWrap,
            needsBoxedWrap,
            needsFundamentalWrap,
            needsInterfaceWrap,
            needsStructWrap,
            needsArrayItemWrap,
            arrayItemType,
            arrayItemIsInterface,
            needsHashTableWrap,
        };
    }

    /**
     * Generates a unique result variable name.
     * Avoids collision with a parameter named "result".
     */
    getResultVarName(parameters: readonly GirParameter[]): string {
        const hasResultParam = parameters.some((p) => this.toJsParamName(p) === "result");
        return hasResultParam ? "_result" : "result";
    }

    /**
     * Builds a parameter list for method declarations.
     *
     * @param parameters - The normalized parameters
     * @returns Array of parameter structures
     *
     * @example
     * ```typescript
     * const params = builder.buildParameterList(method.parameters);
     * ```
     */
    buildParameterList(
        parameters: readonly GirParameter[],
    ): Array<{ name: string; type: string; optional?: boolean; isRestParameter?: boolean }> {
        const filteredParams = this.filterParameters(parameters);

        const required = filteredParams.filter((p) => !p.optional && !p.nullable);
        const omittable = filteredParams.filter((p) => p.optional || p.nullable);
        const reordered = [...required, ...omittable];

        const result: Array<{ name: string; type: string; optional?: boolean; isRestParameter?: boolean }> =
            reordered.map((param) => {
                const mapped = this.ffiMapper.mapParameter(param);
                this.addTypeImportsFromMapping(mapped);
                if (mapped.ffi.type === "ref") {
                    this.imports.addImport("@gtkx/native", ["Ref"]);
                }

                const paramName = this.toJsParamName(param);
                const isOmittable = param.optional || param.nullable;

                const isCallback = mapped.ffi.type === "callback";
                const nullableType = isCallback ? `(${mapped.ts}) | null` : `${mapped.ts} | null`;

                return {
                    name: paramName,
                    type: param.nullable ? nullableType : mapped.ts,
                    optional: isOmittable,
                };
            });

        if (hasVarargs(parameters)) {
            this.imports.addTypeImport("@gtkx/native", ["Arg"]);
            result.push({
                name: "args",
                type: "Arg[]",
                isRestParameter: true,
            });
        }

        return result;
    }

    /**
     * Builds a complete MethodStructure for method declarations.
     *
     * Consolidates the common pattern used across RecordGenerator, InterfaceGenerator,
     * and MethodBuilder for building method structures.
     *
     * @param method - The normalized method definition
     * @param options - Configuration options
     * @returns MethodStructure for generators
     *
     * @example
     * ```typescript
     * const structure = builder.buildMethodStructure(method, {
     *   methodName: "onClick",
     *   selfTypeDescriptor: { type: "gobject", ownership: "borrowed" },
     *   sharedLibrary: "libgtk-4.so.1",
     *   namespace: "Gtk",
     * });
     * ```
     */
    buildMethodStructure(method: GirMethod, options: MethodStructureOptions): MethodStructure {
        const params = this.buildParameterList(method.parameters);
        const returnTypeMapping = this.ffiMapper.mapType(
            method.returnType,
            true,
            method.returnType.transferOwnership,
            1,
        );
        this.addTypeImportsFromMapping(returnTypeMapping);

        const tsReturnType = formatNullableReturn(returnTypeMapping.ts, method.returnType.nullable === true);

        return {
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

    buildStaticFunctionStructure(func: GirFunction, options: StaticFunctionStructureOptions): MethodStructure {
        const funcName = toValidMemberName(toCamelCase(func.name));
        const params = this.buildParameterList(func.parameters);
        const returnTypeMapping = this.ffiMapper.mapType(func.returnType, true, func.returnType.transferOwnership);
        this.addTypeImportsFromMapping(returnTypeMapping);

        const returnTypeName = func.returnType.name as string | undefined;
        const returnsOwnClass =
            returnTypeName === options.originalClassName || returnTypeName?.endsWith(`.${options.originalClassName}`);
        const baseReturnType = returnsOwnClass ? options.className : returnTypeMapping.ts;
        const tsReturnType = formatNullableReturn(baseReturnType, func.returnType.nullable === true);

        return {
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

    writeCallbackWrapperDeclarations(writer: Writer, args: readonly CallArgument[]): void {
        for (const arg of args) {
            if (arg.callbackWrapper) {
                writer.write(`const ${arg.callbackWrapper.wrappedName} = `);
                arg.callbackWrapper.wrapExpression(writer);
                writer.write(";");
                writer.newLine();
            }
        }
    }

    writeArgumentsToWriter(writer: Writer, args: readonly CallArgument[]): void {
        for (const arg of args) {
            writer.write(`{ type: ${JSON.stringify(arg.type)}`);
            writer.writeLine(`, value: ${arg.value}, optional: ${arg.optional ?? false} },`);
        }
    }

    /**
     * Builds call arguments as an array of CallArgument objects.
     * Used with CallExpressionBuilder.toWriter() for code generation.
     *
     * @param parameters - The parameters to build arguments for
     * @param sizeParamOffset - Offset to add to sizeParamIndex for sized arrays (1 for instance methods, 0 for static)
     */
    buildCallArgumentsArray(parameters: readonly GirParameter[], sizeParamOffset = 0): CallArgument[] {
        const filtered = this.filterParameters(parameters);

        return filtered.map((param) => {
            const mapped = this.ffiMapper.mapParameter(param, sizeParamOffset);
            const jsParamName = this.toJsParamName(param);
            const isOptional = this.ffiMapper.isNullable(param);
            const valueName = this.callExpression.buildValueExpression(jsParamName, mapped, isOptional);

            const callbackWrapper = this.buildCallbackWrapper(param, jsParamName, isOptional);

            return {
                type: mapped.ffi,
                value: callbackWrapper ? callbackWrapper.wrappedName : valueName,
                optional: isOptional,
                callbackWrapper,
            };
        });
    }

    private buildCallbackWrapper(
        param: GirParameter,
        jsParamName: string,
        isOptional: boolean,
    ): CallbackWrapperInfo | undefined {
        const callbackParams = this.ffiMapper.getCallbackParamMappings(param);
        const callbackReturnType = this.ffiMapper.getCallbackReturnType(param);
        const returnUnwrapInfo = this.paramWrapWriter.needsReturnUnwrap(callbackReturnType);

        const wrapInfos = callbackParams
            ? callbackParams.map((p) => ({
                  ...p,
                  wrapInfo: this.paramWrapWriter.needsParamWrap(p.mapped),
              }))
            : [];

        const anyParamNeedsWrap = wrapInfos.some((w) => w.wrapInfo.needsWrap);
        const needsWrapper = anyParamNeedsWrap || returnUnwrapInfo.needsUnwrap;

        if (!needsWrapper) {
            return undefined;
        }

        for (const w of wrapInfos) {
            if (w.wrapInfo.needsWrap) {
                this.imports.addImport("../../registry.js", ["getNativeObject"]);
            }
            this.addTypeImportsFromMapping(w.mapped);
        }

        const wrappedName = createWrappedName(jsParamName);
        const wrapExpression = this.paramWrapWriter.buildCallbackWrapperExpression(
            jsParamName,
            wrapInfos,
            returnUnwrapInfo,
        );

        return {
            paramName: jsParamName,
            wrappedName,
            wrapExpression,
            isOptional,
        };
    }

    /**
     * Writes method body using our Writer.
     *
     * @param method - The normalized method definition
     * @param returnTypeMapping - The mapped return type
     * @param options - Configuration options
     * @returns Function that writes the method body
     *
     * @example
     * ```typescript
     * const bodyFn = builder.writeMethodBody(method, returnTypeMapping, options);
     * bodyFn(writer);
     * ```
     */
    writeMethodBody(
        method: GirMethod,
        returnTypeMapping: MappedType,
        options: MethodBodyStatementsOptions,
    ): (writer: Writer) => void {
        return this.writeCallableBody({
            sharedLibrary: options.sharedLibrary,
            cIdentifier: method.cIdentifier,
            parameters: method.parameters,
            returnType: method.returnType,
            returnTypeMapping,
            throws: method.throws,
            self: { type: options.selfTypeDescriptor, value: "this.handle" },
            hasVarargs: hasVarargs(method.parameters),
        });
    }

    /**
     * Writes function body using our Writer.
     *
     * @param func - The normalized function definition
     * @param returnTypeMapping - The mapped return type
     * @param options - Configuration options
     * @returns Function that writes the function body
     *
     * @example
     * ```typescript
     * const bodyFn = builder.writeFunctionBody(func, returnTypeMapping, options);
     * bodyFn(writer);
     * ```
     */
    writeFunctionBody(
        func: GirFunction,
        returnTypeMapping: MappedType,
        options: FunctionBodyStatementsOptions,
    ): (writer: Writer) => void {
        return this.writeCallableBody({
            sharedLibrary: options.sharedLibrary,
            cIdentifier: func.cIdentifier,
            parameters: func.parameters,
            returnType: func.returnType,
            returnTypeMapping,
            throws: func.throws,
            ownClassName: options.returnsOwnClass ? options.className : undefined,
            hasVarargs: hasVarargs(func.parameters),
        });
    }

    private writeCallableBody(options: CallableBodyOptions): (writer: Writer) => void {
        this.imports.addImport("../../native.js", ["call"]);
        this.imports.addTypeImport("../../object.js", ["NativeHandle"]);
        this.imports.addImport("../../registry.js", ["getNativeObject"]);

        const isNullable = options.returnType.nullable === true;
        const rawReturnType = options.returnTypeMapping.ts;
        const baseReturnType = options.ownClassName ?? rawReturnType;
        const wrapInfo = this.needsObjectWrap(options.returnTypeMapping);
        const hasReturnValue = baseReturnType !== "void";
        const hasOwnClassReturn = options.ownClassName !== undefined;
        const hasObjectWrapReturn = wrapInfo.needsWrap && hasReturnValue;

        if (options.throws) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
            this.setupGErrorImports();
        }

        if (hasOwnClassReturn || hasObjectWrapReturn || (wrapInfo.needsArrayItemWrap && wrapInfo.arrayItemType)) {
            this.imports.addImport("../../registry.js", ["getNativeObject"]);
        }

        const gtkAllocatesRefs = this.identifyGtkAllocatedRefs(options.parameters);
        if (gtkAllocatesRefs.length > 0) {
            this.imports.addImport("../../registry.js", ["getNativeObject"]);
        }

        return (writer) => {
            const tsReturnType = formatNullableReturn(baseReturnType, isNullable);
            const resultVarName = this.getResultVarName(options.parameters);

            if (options.throws) {
                writer.writeLine("const error = createRef<NativeHandle | null>(null);");
            }

            const sizeParamOffset = options.self ? 1 : 0;
            const args = this.buildCallArgumentsArray(options.parameters, sizeParamOffset);

            this.writeCallbackWrapperDeclarations(writer, args);

            if (options.throws) {
                args.push({
                    type: this.ffiTypeWriter.createGErrorRefTypeDescriptor(),
                    value: "error",
                });
            }

            if (hasOwnClassReturn || hasObjectWrapReturn) {
                writer.write("const ptr = ");
                this.callExpression.toWriter({
                    sharedLibrary: options.sharedLibrary,
                    cIdentifier: options.cIdentifier,
                    args,
                    returnType: options.returnTypeMapping.ffi,
                    selfArg: options.self,
                    hasVarargs: options.hasVarargs,
                })(writer);
                writer.write(";");
                writer.newLine();

                if (options.throws) {
                    this.writeErrorCheck(writer);
                }
                this.writeRefRewrap(writer, gtkAllocatesRefs);

                if (hasOwnClassReturn) {
                    writer.writeLine(`return getNativeObject(ptr as NativeHandle, ${options.ownClassName});`);
                } else {
                    if (isNullable) {
                        writer.writeLine("if (ptr === null) return null;");
                    }
                    if (
                        wrapInfo.needsBoxedWrap ||
                        wrapInfo.needsFundamentalWrap ||
                        wrapInfo.needsStructWrap ||
                        wrapInfo.needsInterfaceWrap
                    ) {
                        writer.writeLine(`return getNativeObject(ptr as NativeHandle, ${baseReturnType});`);
                    } else {
                        writer.writeLine(`return getNativeObject(ptr as NativeHandle) as ${baseReturnType};`);
                    }
                }
            } else if (wrapInfo.needsArrayItemWrap && wrapInfo.arrayItemType) {
                writer.write("const arr = ");
                this.callExpression.toWriter({
                    sharedLibrary: options.sharedLibrary,
                    cIdentifier: options.cIdentifier,
                    args,
                    returnType: options.returnTypeMapping.ffi,
                    selfArg: options.self,
                    hasVarargs: options.hasVarargs,
                })(writer);
                writer.write(" as unknown[];");
                writer.newLine();

                if (options.throws) {
                    this.writeErrorCheck(writer);
                }
                this.writeRefRewrap(writer, gtkAllocatesRefs);

                if (wrapInfo.arrayItemIsInterface) {
                    writer.writeLine(
                        `return arr.map((item) => getNativeObject(item as NativeHandle, ${wrapInfo.arrayItemType}));`,
                    );
                } else {
                    writer.writeLine(
                        `return arr.map((item) => getNativeObject(item as NativeHandle) as ${wrapInfo.arrayItemType});`,
                    );
                }
            } else if (wrapInfo.needsHashTableWrap) {
                writer.write("const tuples = ");
                this.callExpression.toWriter({
                    sharedLibrary: options.sharedLibrary,
                    cIdentifier: options.cIdentifier,
                    args,
                    returnType: options.returnTypeMapping.ffi,
                    selfArg: options.self,
                    hasVarargs: options.hasVarargs,
                })(writer);
                writer.write(" as [unknown, unknown][];");
                writer.newLine();

                if (options.throws) {
                    this.writeErrorCheck(writer);
                }
                this.writeRefRewrap(writer, gtkAllocatesRefs);

                if (isNullable) {
                    writer.writeLine("if (tuples === null) return null;");
                }
                writer.writeLine(`return new Map(tuples) as ${tsReturnType};`);
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
                    hasVarargs: options.hasVarargs,
                })(writer);

                if (needsCast) {
                    writer.write(` as unknown as ${tsReturnType}`);
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
     * Sets up GError import tracking and returns the appropriate GError reference.
     * Call this when generating error handling code that uses getNativeObject with GError.
     *
     * @param currentNamespace - The current namespace being generated
     * @returns The GError class reference to use (e.g., "GLib.GError" or "GError")
     */
    setupGErrorImports(currentNamespace?: string): string {
        this.imports.addImport("../../native.js", ["NativeError"]);
        this.imports.addImport("../../registry.js", ["getNativeObject"]);

        const isGLibNamespace = currentNamespace === "GLib";
        const gerrorRef = isGLibNamespace ? "GError" : "GLib.GError";

        if (isGLibNamespace) {
            this.imports.addImport("./error.js", ["GError"]);
        } else {
            this.imports.addNamespaceImport("../glib/index.js", "GLib");
        }

        return gerrorRef;
    }

    private writeErrorCheck(writer: Writer): void {
        const gerrorRef = this.setupGErrorImports();

        writer.writeLine("if (error.value !== null) {");
        writer.withIndent(() => {
            writer.writeLine(`throw new NativeError(getNativeObject(error.value, ${gerrorRef}));`);
        });
        writer.writeLine("}");
    }

    private writeRefRewrap(writer: Writer, refs: GtkAllocatedRef[]): void {
        for (const ref of refs) {
            if (ref.isArray && ref.arrayItemType) {
                if (ref.arrayItemIsBoxed || ref.arrayItemIsInterface) {
                    writer.writeLine(
                        `if (${ref.paramName}) ${ref.paramName}.value = (${ref.paramName}.value as unknown as NativeHandle[]).map((item) => getNativeObject(item, ${ref.arrayItemType}));`,
                    );
                } else {
                    writer.writeLine(
                        `if (${ref.paramName}) ${ref.paramName}.value = (${ref.paramName}.value as unknown as NativeHandle[]).map((item) => getNativeObject(item) as ${ref.arrayItemType});`,
                    );
                }
            } else if (ref.isBoxed || ref.isInterface) {
                writer.writeLine(
                    `if (${ref.paramName}) ${ref.paramName}.value = getNativeObject(${ref.paramName}.value as unknown as NativeHandle, ${ref.innerType});`,
                );
            } else {
                writer.writeLine(
                    `if (${ref.paramName}) ${ref.paramName}.value = getNativeObject(${ref.paramName}.value as unknown as NativeHandle) as ${ref.innerType};`,
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
     * @returns Function that writes the factory method body
     *
     * @example
     * ```typescript
     * const body = builder.writeFactoryMethodBody({
     *   sharedLibrary: "libgtk-4.so.1",
     *   cIdentifier: "gtk_button_new_with_label",
     *   args: callArgs,
     *   returnTypeDescriptor: { type: "gobject", ownership: "full" },
     *   wrapClassName: "Button",
     *   throws: false,
     *   useClassInWrap: false,
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
    }): (writer: Writer) => void {
        this.imports.addImport("../../native.js", ["call"]);
        this.imports.addTypeImport("../../object.js", ["NativeHandle"]);
        this.imports.addImport("../../registry.js", ["getNativeObject"]);
        const { sharedLibrary, cIdentifier, args, returnTypeDescriptor, wrapClassName, throws, useClassInWrap } =
            options;

        if (throws) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
            this.setupGErrorImports();
        }

        return (writer) => {
            this.writeCallbackWrapperDeclarations(writer, args);

            if (throws) {
                writer.writeLine("const error = createRef<NativeHandle | null>(null);");
                args.push({
                    type: this.ffiTypeWriter.createGErrorRefTypeDescriptor(),
                    value: "error",
                });
            }

            writer.write("const ptr = call(");
            writer.newLine();
            writer.withIndent(() => {
                writer.writeLine(`"${sharedLibrary}",`);
                writer.writeLine(`"${cIdentifier}",`);
                writer.writeLine("[");
                writer.withIndent(() => {
                    this.writeArgumentsToWriter(writer, args);
                });
                writer.writeLine("],");
                writer.write(JSON.stringify(returnTypeDescriptor));
                writer.newLine();
            });
            writer.writeLine(");");

            if (throws) {
                this.writeErrorCheck(writer);
            }

            if (useClassInWrap) {
                writer.writeLine(`return getNativeObject(ptr as NativeHandle, ${wrapClassName});`);
            } else {
                writer.writeLine(`return getNativeObject(ptr as NativeHandle) as ${wrapClassName};`);
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
     * Processes type imports from a MappedType, adding them via the ImportCollector.
     */
    private addTypeImportsFromMapping(mapped: MappedType): void {
        for (const imp of mapped.imports) {
            if (!imp.isExternal && this.selfNames.has(imp.transformedName)) continue;
            if (imp.isExternal) {
                this.imports.addNamespaceImport(`../${imp.namespace.toLowerCase()}/index.js`, imp.namespace);
            } else {
                switch (imp.kind) {
                    case "enum":
                    case "flags":
                        this.imports.addImport("./enums.js", [imp.transformedName]);
                        break;
                    case "record":
                    case "class":
                    case "interface":
                        this.imports.addImport(`./${toKebabCase(imp.name)}.js`, [imp.transformedName]);
                        break;
                    case "callback":
                        break;
                }
            }
        }
    }
}
