/**
 * Method Body Builder
 *
 * Shared utilities for building method/function bodies.
 * Extracts common patterns from RecordGenerator, InterfaceGenerator, ClassGenerator.
 */

import type { GirConstructor, GirFunction, GirMethod, GirParameter, GirType } from "@gtkx/gir";
import type { Writer } from "../../builders/writer.js";
import type { FfiMapper } from "../type-system/ffi-mapper.js";
import {
    FFI_VOID,
    type FfiTypeDescriptor,
    type MappedType,
    type SelfTypeDescriptor,
} from "../type-system/ffi-types.js";
import { buildJsDocStructure } from "../utils/doc-formatter.js";
import { hasVarargs, isVararg } from "../utils/filtering.js";
import { createWrappedName, toCamelCase, toKebabCase, toValidIdentifier, toValidMemberName } from "../utils/naming.js";
import { formatNullableReturn } from "../utils/type-qualification.js";
import {
    type CallArgument,
    type CallbackWrapperInfo,
    CallExpressionBuilder,
    type CallExpressionOptions,
} from "./call-expression-builder.js";
import {
    buildCallableShape,
    type CallableShape,
    type HiddenOut,
    type ParamMapping,
    type ShapeCallArg,
} from "./callable-shape.js";
import type { FfiDescriptorRegistry } from "./descriptor-registry.js";
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

const VOID_RETURN_MAPPING: MappedType = { ts: "void", ffi: FFI_VOID, imports: [] };

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
    /** Pre-computed callable shape covering signature/hidden/tuple decisions. */
    shape: CallableShape;
    /** Original GIR parameters — required for resolving callback wrappers. */
    parameters: readonly GirParameter[];
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
 * - Out/inout parameter handling via {@link CallableShape}
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
        descriptors?: FfiDescriptorRegistry,
    ) {
        this.ffiTypeWriter = ffiTypeWriter ?? new FfiTypeWriter();
        this.callExpression = new CallExpressionBuilder(descriptors, imports);
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
     * Checks if any parameter has an unsupported callback type.
     */
    hasUnsupportedCallbacks(params: readonly GirParameter[]): boolean {
        return params.some((p) => this.ffiMapper.hasUnsupportedCallback(p));
    }

    /**
     * Selects supported constructors and identifies the main constructor.
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
     * Builds a callable shape from raw parameters.
     *
     * Computes signature visibility, hidden allocations, and the
     * return-tuple plan in a single pass. Imports collected by the shape
     * are forwarded to the import collector.
     */
    buildShape(
        parameters: readonly GirParameter[],
        returnType: GirType | undefined,
        sizeParamOffset: number,
    ): CallableShape {
        const returnMapping =
            returnType !== undefined
                ? this.ffiMapper.mapType(returnType, true, returnType.transferOwnership, sizeParamOffset)
                : VOID_RETURN_MAPPING;

        const shape = buildCallableShape({
            parameters,
            returnTypeMapping: returnMapping,
            returnNullable: returnType?.nullable === true,
            sizeParamOffset,
            ffiMapper: this.ffiMapper,
        });

        for (const imp of shape.imports) {
            this.addTypeImport(imp);
        }
        for (const mapping of shape.paramMappings) {
            if (mapping.mapped.ffi.type === "ref") {
                this.imports.addTypeImport("../../object.js", ["NativeHandle"]);
            }
        }
        return shape;
    }

    /**
     * Builds parameter list entries for a method declaration from a shape.
     */
    buildSignatureParameters(
        shape: CallableShape,
        hasVarargsFlag: boolean,
    ): Array<{ name: string; type: string; optional?: boolean; isRestParameter?: boolean }> {
        const result: Array<{ name: string; type: string; optional?: boolean; isRestParameter?: boolean }> =
            shape.signatureParams.map((p) => ({
                name: p.name,
                type: p.tsType,
                optional: p.optional,
            }));

        if (hasVarargsFlag) {
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
     * Builds a parameter list for method declarations from raw parameters.
     *
     * Used by callers that don't construct a shape themselves
     * (e.g., async wrapper generation, where there are no out/inout params).
     */
    buildParameterList(
        parameters: readonly GirParameter[],
    ): Array<{ name: string; type: string; optional?: boolean; isRestParameter?: boolean }> {
        const shape = this.buildShape(parameters, undefined, 0);
        return this.buildSignatureParameters(shape, hasVarargs(parameters));
    }

    /**
     * Computes the public TypeScript return type for a callable based on its shape.
     */
    computeReturnTypeString(shape: CallableShape, ownClassName: string | undefined): string {
        if (shape.returnTupleEntries.length === 0) {
            if (!shape.hasOriginalReturn) return "void";
            const base = ownClassName ?? shape.originalReturnTsType;
            return formatNullableReturn(base, shape.originalReturnNullable);
        }
        if (shape.returnTupleEntries.length === 1 && !shape.hasOriginalReturn) {
            const entry = shape.returnTupleEntries[0];
            if (!entry) {
                return "void";
            }
            return entry.nullable ? `${entry.tsType} | null` : entry.tsType;
        }
        const parts = shape.returnTupleEntries.map((entry) => {
            if (entry.kind === "original-return") {
                const base = ownClassName ?? entry.tsType;
                return entry.nullable ? `${base} | null` : base;
            }
            return entry.nullable ? `${entry.tsType} | null` : entry.tsType;
        });
        return `[${parts.join(", ")}]`;
    }

    /**
     * Builds a writer that emits one FFI call expression. Routes through the
     * shared {@link CallExpressionBuilder} so the descriptor participates in
     * per-file hoisting (when a registry is configured) or falls back to an
     * inline `call(...)` for variadic callables.
     */
    buildCallWriter(options: CallExpressionOptions): (writer: Writer) => void {
        return this.callExpression.toWriter(options);
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
     * Builds CallArgument entries from a callable shape.
     *
     * Resolves callback wrappers and translates {@link ShapeCallArg} into
     * the {@link CallArgument} form consumed by {@link CallExpressionBuilder}.
     */
    buildShapeCallArguments(shape: CallableShape, parameters: readonly GirParameter[]): CallArgument[] {
        return shape.callArgs.map((arg) => this.toCallArgument(arg, parameters, shape));
    }

    /**
     * Builds call arguments from raw parameters (compatibility entry point).
     *
     * Async wrapper generation calls this directly; it has no out/inout
     * params so the shape's tuple is empty.
     */
    buildCallArgumentsArray(parameters: readonly GirParameter[], sizeParamOffset = 0): CallArgument[] {
        const shape = this.buildShape(parameters, undefined, sizeParamOffset);
        return this.buildShapeCallArguments(shape, parameters);
    }

    /**
     * Builds a complete MethodStructure for method declarations.
     */
    buildMethodStructure(method: GirMethod, options: MethodStructureOptions): MethodStructure {
        let shape = this.buildShape(method.parameters, method.returnType, 1);
        if (this.shouldStripBooleanReturn(method, shape)) {
            shape = this.stripBooleanReturn(shape);
        }
        const params = this.buildSignatureParameters(shape, hasVarargs(method.parameters));
        this.addTypeImportsFromMapping(shape.returnTypeMapping);

        const tsReturnType = this.computeReturnTypeString(shape, undefined);

        return {
            name: options.methodName,
            parameters: params,
            returnType: tsReturnType === "void" ? undefined : tsReturnType,
            docs: buildJsDocStructure(method.doc, options.namespace),
            statements: this.writeMethodBody(method, shape, {
                sharedLibrary: options.sharedLibrary,
                selfTypeDescriptor: options.selfTypeDescriptor,
                className: options.className,
            }),
        };
    }

    buildStaticFunctionStructure(func: GirFunction, options: StaticFunctionStructureOptions): MethodStructure {
        const funcName = toValidMemberName(toCamelCase(func.name));
        let shape = this.buildShape(func.parameters, func.returnType, 0);
        if (this.shouldStripBooleanReturn(func, shape)) {
            shape = this.stripBooleanReturn(shape);
        }
        const params = this.buildSignatureParameters(shape, hasVarargs(func.parameters));
        this.addTypeImportsFromMapping(shape.returnTypeMapping);

        const returnTypeName = func.returnType.name as string | undefined;
        const returnsOwnClass =
            returnTypeName === options.originalClassName || returnTypeName?.endsWith(`.${options.originalClassName}`);
        const ownClassName = returnsOwnClass ? options.className : undefined;
        const tsReturnType = this.computeReturnTypeString(shape, ownClassName);

        return {
            name: funcName,
            isStatic: true,
            parameters: params,
            returnType: tsReturnType === "void" ? undefined : tsReturnType,
            docs: buildJsDocStructure(func.doc, options.namespace),
            statements: this.writeFunctionBody(func, shape, {
                sharedLibrary: options.sharedLibrary,
                className: options.className,
                returnsOwnClass,
            }),
        };
    }

    private shouldStripBooleanReturn(callable: { throws?: boolean; returnType: GirType }, shape: CallableShape): boolean {
        if (!callable.throws) return false;
        if (!shape.hasOriginalReturn) return false;
        return callable.returnType.name === "gboolean";
    }

    private stripBooleanReturn(shape: CallableShape): CallableShape {
        return {
            ...shape,
            hasOriginalReturn: false,
            returnTupleEntries: shape.returnTupleEntries.filter((entry) => entry.kind !== "original-return"),
        };
    }

    /**
     * Writes method body using the precomputed shape.
     */
    writeMethodBody(
        method: GirMethod,
        shape: CallableShape,
        options: MethodBodyStatementsOptions,
    ): (writer: Writer) => void {
        return this.writeCallableBody({
            sharedLibrary: options.sharedLibrary,
            cIdentifier: method.cIdentifier,
            shape,
            parameters: method.parameters,
            throws: method.throws,
            self: { type: options.selfTypeDescriptor, value: "this.handle" },
            hasVarargs: hasVarargs(method.parameters),
        });
    }

    /**
     * Writes function body using the precomputed shape.
     */
    writeFunctionBody(
        func: GirFunction,
        shape: CallableShape,
        options: FunctionBodyStatementsOptions,
    ): (writer: Writer) => void {
        return this.writeCallableBody({
            sharedLibrary: options.sharedLibrary,
            cIdentifier: func.cIdentifier,
            shape,
            parameters: func.parameters,
            throws: func.throws,
            ownClassName: options.returnsOwnClass ? options.className : undefined,
            hasVarargs: hasVarargs(func.parameters),
        });
    }

    private writeCallableBody(options: CallableBodyOptions): (writer: Writer) => void {
        this.imports.addTypeImport("../../object.js", ["NativeHandle"]);

        const { shape } = options;
        const ownClassName = options.ownClassName;
        const wrapInfo = this.needsObjectWrap(shape.returnTypeMapping);
        const hasReturnValue = shape.hasOriginalReturn;
        const hasOwnClassReturn = ownClassName !== undefined;
        const hasObjectWrapReturn = wrapInfo.needsWrap && hasReturnValue;
        const hasRefHandleHidden = shape.hiddenOuts.some((h) => h.kind === "ref-handle");

        if (options.throws) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
            this.setupGErrorImports();
        }

        if (
            hasOwnClassReturn ||
            hasObjectWrapReturn ||
            (wrapInfo.needsArrayItemWrap && wrapInfo.arrayItemType) ||
            hasRefHandleHidden
        ) {
            this.imports.addImport("../../registry.js", ["getNativeObject"]);
        }

        if (shape.hiddenOuts.length > 0) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
        }

        return (writer) => {
            const callArguments = this.buildShapeCallArguments(shape, options.parameters);

            this.writeCallbackWrapperDeclarations(writer, callArguments);

            if (options.throws) {
                writer.writeLine("const error = createRef<NativeHandle | null>(null);");
            }

            for (const hidden of shape.hiddenOuts) {
                this.writeHiddenOutDeclaration(writer, hidden);
            }

            if (options.throws) {
                callArguments.push({
                    type: this.ffiTypeWriter.createGErrorRefTypeDescriptor(),
                    value: "error",
                });
            }

            const returnTupleNeedsBuild = shape.returnTupleEntries.length > 0;
            const writeCall = (target: string | null, cast: string | null) => {
                if (target !== null) {
                    writer.write(`const ${target} = `);
                } else {
                    writer.write("return ");
                }
                this.callExpression.toWriter({
                    sharedLibrary: options.sharedLibrary,
                    cIdentifier: options.cIdentifier,
                    args: callArguments,
                    returnType: shape.returnTypeMapping.ffi,
                    selfArg: options.self,
                    hasVarargs: options.hasVarargs,
                })(writer);
                if (cast !== null) {
                    writer.write(` as ${cast}`);
                }
                writer.write(";");
                writer.newLine();
            };

            const rawReturnType = shape.originalReturnTsType;
            const baseReturnType = ownClassName ?? rawReturnType;
            const tsReturnType = formatNullableReturn(baseReturnType, shape.originalReturnNullable);

            if (returnTupleNeedsBuild || options.throws || shape.hiddenOuts.some((h) => h.kind === "ref-handle")) {
                this.emitTupleReturningBody(writer, options, shape, callArguments, wrapInfo, ownClassName);
                return;
            }

            if (hasOwnClassReturn || hasObjectWrapReturn) {
                writeCall("ptr", null);
                this.writeRefHandleRewrap(writer, shape);
                if (hasOwnClassReturn) {
                    writer.writeLine(`return getNativeObject(ptr as NativeHandle, ${ownClassName});`);
                } else {
                    if (shape.originalReturnNullable) {
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
                return;
            }

            if (wrapInfo.needsArrayItemWrap && wrapInfo.arrayItemType) {
                writeCall("arr", "unknown[]");
                this.writeRefHandleRewrap(writer, shape);
                if (wrapInfo.arrayItemIsInterface) {
                    writer.writeLine(
                        `return arr.map((item) => getNativeObject(item as NativeHandle, ${wrapInfo.arrayItemType}));`,
                    );
                } else {
                    writer.writeLine(
                        `return arr.map((item) => getNativeObject(item as NativeHandle) as ${wrapInfo.arrayItemType});`,
                    );
                }
                return;
            }

            if (wrapInfo.needsHashTableWrap) {
                writeCall("tuples", "[unknown, unknown][]");
                this.writeRefHandleRewrap(writer, shape);
                if (shape.originalReturnNullable) {
                    writer.writeLine("if (tuples === null) return null;");
                }
                writer.writeLine(`return new Map(tuples) as ${tsReturnType};`);
                return;
            }

            const needsCast = rawReturnType !== "void" && rawReturnType !== "unknown";
            if (hasReturnValue) {
                writer.write("return ");
            }
            this.callExpression.toWriter({
                sharedLibrary: options.sharedLibrary,
                cIdentifier: options.cIdentifier,
                args: callArguments,
                returnType: shape.returnTypeMapping.ffi,
                selfArg: options.self,
                hasVarargs: options.hasVarargs,
            })(writer);
            if (hasReturnValue && needsCast) {
                writer.write(` as ${tsReturnType}`);
            }
            writer.write(";");
            writer.newLine();
        };
    }

    private emitTupleReturningBody(
        writer: Writer,
        options: CallableBodyOptions,
        shape: CallableShape,
        callArguments: CallArgument[],
        wrapInfo: ReturnType<MethodBodyWriter["needsObjectWrap"]>,
        ownClassName: string | undefined,
    ): void {
        const baseReturnType = ownClassName ?? shape.originalReturnTsType;
        const tsReturnType = formatNullableReturn(baseReturnType, shape.originalReturnNullable);
        const hasReturnValue = shape.hasOriginalReturn;
        const hasOwnClassReturn = ownClassName !== undefined;
        const needsResultPtr = hasReturnValue && (wrapInfo.needsWrap || hasOwnClassReturn);
        const needsArrayWrapVar = hasReturnValue && wrapInfo.needsArrayItemWrap && wrapInfo.arrayItemType;
        const needsHashTableVar = hasReturnValue && wrapInfo.needsHashTableWrap;

        let resultExpression: string | null = null;

        if (hasReturnValue) {
            const baseVar = this.uniqueResultVarName(shape, "result");
            const suffix = needsResultPtr ? "Ptr" : needsArrayWrapVar ? "Arr" : needsHashTableVar ? "Tuples" : "";
            resultExpression = `${baseVar}${suffix}`;
            writer.write(`const ${resultExpression} = `);
            this.callExpression.toWriter({
                sharedLibrary: options.sharedLibrary,
                cIdentifier: options.cIdentifier,
                args: callArguments,
                returnType: shape.returnTypeMapping.ffi,
                selfArg: options.self,
                hasVarargs: options.hasVarargs,
            })(writer);
            if (needsArrayWrapVar) {
                writer.write(" as unknown[]");
            } else if (needsHashTableVar) {
                writer.write(" as [unknown, unknown][]");
            } else if (!needsResultPtr) {
                writer.write(` as ${tsReturnType}`);
            }
            writer.write(";");
            writer.newLine();
        } else {
            this.callExpression.toWriter({
                sharedLibrary: options.sharedLibrary,
                cIdentifier: options.cIdentifier,
                args: callArguments,
                returnType: shape.returnTypeMapping.ffi,
                selfArg: options.self,
                hasVarargs: options.hasVarargs,
            })(writer);
            writer.write(";");
            writer.newLine();
        }

        if (options.throws) {
            this.writeErrorCheck(writer);
        }

        const rewrapBindings = this.writeRefHandleRewrap(writer, shape);

        let originalReturnExpression: string | null = null;
        if (hasReturnValue && resultExpression !== null) {
            if (hasOwnClassReturn) {
                originalReturnExpression = `getNativeObject(${resultExpression} as NativeHandle, ${ownClassName})`;
            } else if (wrapInfo.needsWrap) {
                if (shape.originalReturnNullable) {
                    writer.writeLine(
                        `const ${resultExpression}Wrapped = ${resultExpression} === null ? null : ${this.formatObjectWrap(resultExpression, baseReturnType, wrapInfo)};`,
                    );
                    originalReturnExpression = `${resultExpression}Wrapped`;
                } else {
                    originalReturnExpression = this.formatObjectWrap(resultExpression, baseReturnType, wrapInfo);
                }
            } else if (wrapInfo.needsArrayItemWrap && wrapInfo.arrayItemType) {
                if (wrapInfo.arrayItemIsInterface) {
                    originalReturnExpression = `${resultExpression}.map((item) => getNativeObject(item as NativeHandle, ${wrapInfo.arrayItemType}))`;
                } else {
                    originalReturnExpression = `${resultExpression}.map((item) => getNativeObject(item as NativeHandle) as ${wrapInfo.arrayItemType})`;
                }
            } else if (wrapInfo.needsHashTableWrap) {
                originalReturnExpression = shape.originalReturnNullable
                    ? `(${resultExpression} === null ? null : new Map(${resultExpression}) as ${baseReturnType})`
                    : `(new Map(${resultExpression}) as ${baseReturnType})`;
            } else {
                originalReturnExpression = resultExpression;
            }
        }

        if (shape.returnTupleEntries.length === 0) {
            if (originalReturnExpression !== null) {
                writer.writeLine(`return ${originalReturnExpression};`);
            }
            return;
        }

        const tupleParamMappings = shape.paramMappings.filter((m) => m.isOut && !m.isLengthParam);
        const tupleExprs: string[] = [];
        let outIndex = 0;
        for (const entry of shape.returnTupleEntries) {
            if (entry.kind === "original-return") {
                tupleExprs.push(originalReturnExpression ?? "undefined");
                continue;
            }
            const mapping = tupleParamMappings[outIndex];
            tupleExprs.push(this.expressionForOutMapping(shape, mapping, rewrapBindings));
            outIndex++;
        }

        if (shape.returnTupleEntries.length === 1 && !shape.hasOriginalReturn) {
            writer.writeLine(`return ${tupleExprs[0]};`);
        } else {
            writer.writeLine(`return [${tupleExprs.join(", ")}];`);
        }
    }

    private expressionForOutMapping(
        shape: CallableShape,
        mapping: ParamMapping | undefined,
        rewrapBindings: Map<string, string>,
    ): string {
        if (!mapping) return "undefined";

        if (mapping.hiddenOutIndex === null) {
            return mapping.nullable || mapping.optional ? `(${mapping.jsName} ?? null)` : mapping.jsName;
        }

        const hidden = shape.hiddenOuts[mapping.hiddenOutIndex];
        if (!hidden) return "undefined";

        if (hidden.kind === "alloc-struct") {
            return hidden.varName;
        }
        if (hidden.kind === "ref-handle") {
            return rewrapBindings.get(hidden.varName) ?? `${hidden.varName}.value`;
        }
        return `${hidden.varName}.value as ${hidden.tsType}`;
    }

    private uniqueResultVarName(shape: CallableShape, base: string): string {
        const usedNames = new Set<string>();
        for (const param of shape.signatureParams) {
            usedNames.add(param.name);
        }
        for (const hidden of shape.hiddenOuts) {
            usedNames.add(hidden.varName);
        }
        if (!usedNames.has(base)) return base;
        let suffix = 2;
        while (usedNames.has(`${base}${suffix}`)) suffix++;
        return `${base}${suffix}`;
    }

    /**
     * Public alias for the hidden-out declaration emitter.
     * Used by the constructor builder to seed factory bodies.
     */
    writeHiddenOutDeclarationFor(writer: Writer, hidden: HiddenOut): void {
        this.writeHiddenOutDeclaration(writer, hidden);
    }

    private writeHiddenOutDeclaration(writer: Writer, hidden: HiddenOut): void {
        if (hidden.kind === "alloc-struct") {
            if (hidden.wrapClassName) {
                writer.writeLine(`const ${hidden.varName} = new ${hidden.wrapClassName}();`);
            } else {
                writer.writeLine(`const ${hidden.varName} = createRef<NativeHandle | null>(null);`);
            }
            return;
        }
        if (hidden.kind === "ref-handle") {
            writer.writeLine(`const ${hidden.varName} = createRef<NativeHandle | null>(null);`);
            return;
        }
        const innerType = hidden.tsType;
        writer.writeLine(`const ${hidden.varName} = createRef<${innerType}>(${hidden.initialValue});`);
    }

    private writeRefHandleRewrap(writer: Writer, shape: CallableShape): Map<string, string> {
        const bindings = new Map<string, string>();
        for (const hidden of shape.hiddenOuts) {
            if (hidden.kind !== "ref-handle") continue;
            const wrappedName = `${hidden.varName}Wrapped`;
            bindings.set(hidden.varName, wrappedName);
            const className = hidden.wrapClassName;
            if (!className) {
                writer.writeLine(`const ${wrappedName} = ${hidden.varName}.value as unknown as ${hidden.tsType};`);
                continue;
            }
            if (hidden.nullable) {
                writer.writeLine(
                    `const ${wrappedName} = ${hidden.varName}.value === null ? null : ${
                        hidden.wrapAsBoxed
                            ? `getNativeObject(${hidden.varName}.value as NativeHandle, ${className})`
                            : `getNativeObject(${hidden.varName}.value as NativeHandle) as ${className}`
                    };`,
                );
            } else {
                writer.writeLine(
                    `const ${wrappedName} = ${
                        hidden.wrapAsBoxed
                            ? `getNativeObject(${hidden.varName}.value as NativeHandle, ${className})`
                            : `getNativeObject(${hidden.varName}.value as NativeHandle) as ${className}`
                    };`,
                );
            }
        }
        return bindings;
    }

    private formatObjectWrap(
        ptrExpr: string,
        baseReturnType: string,
        wrapInfo: ReturnType<MethodBodyWriter["needsObjectWrap"]>,
    ): string {
        if (
            wrapInfo.needsBoxedWrap ||
            wrapInfo.needsFundamentalWrap ||
            wrapInfo.needsStructWrap ||
            wrapInfo.needsInterfaceWrap
        ) {
            return `getNativeObject(${ptrExpr} as NativeHandle, ${baseReturnType})`;
        }
        return `getNativeObject(${ptrExpr} as NativeHandle) as ${baseReturnType}`;
    }

    private toCallArgument(arg: ShapeCallArg, parameters: readonly GirParameter[], shape: CallableShape): CallArgument {
        if (arg.sourceParamIndex !== null) {
            const filtered = parameters.length > 0 ? this.filterParameters(parameters) : [];
            const param = filtered[arg.sourceParamIndex];
            if (param) {
                const mapping = shape.paramMappings.find((m) => m.girIndex === arg.sourceParamIndex);
                if (mapping?.isSignatureParam && !mapping.isOut) {
                    const callbackWrapper = this.buildCallbackWrapper(param, mapping.jsName, mapping.nullable);
                    return {
                        type: arg.ffi,
                        value: callbackWrapper ? callbackWrapper.wrappedName : arg.value,
                        optional: arg.optional,
                        callbackWrapper,
                    };
                }
            }
        }
        return {
            type: arg.ffi,
            value: arg.value,
            optional: arg.optional,
        };
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
     * Sets up GError import tracking and returns the appropriate GError reference.
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

    /**
     * Writes a static factory method body.
     *
     * Out and inout parameters from the original GIR signature are hidden
     * behind internal allocations (passed via {@link hiddenOuts}); their
     * post-call values are discarded — factory methods always return the
     * constructed object.
     */
    writeFactoryMethodBody(options: {
        sharedLibrary: string;
        cIdentifier: string;
        args: CallArgument[];
        returnTypeDescriptor: FfiTypeDescriptor;
        wrapClassName: string;
        throws: boolean;
        useClassInWrap: boolean;
        hiddenOuts?: readonly HiddenOut[];
    }): (writer: Writer) => void {
        this.imports.addTypeImport("../../object.js", ["NativeHandle"]);
        this.imports.addImport("../../registry.js", ["getNativeObject"]);
        const { sharedLibrary, cIdentifier, args, returnTypeDescriptor, wrapClassName, throws, useClassInWrap } =
            options;
        const hiddenOuts = options.hiddenOuts ?? [];

        if (throws) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
            this.setupGErrorImports();
        }
        if (hiddenOuts.length > 0) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
        }

        const allArgs = throws
            ? [...args, { type: this.ffiTypeWriter.createGErrorRefTypeDescriptor(), value: "error" }]
            : args;

        const callWriter = this.callExpression.toWriter({
            sharedLibrary,
            cIdentifier,
            args: allArgs,
            returnType: returnTypeDescriptor,
        });

        return (writer) => {
            this.writeCallbackWrapperDeclarations(writer, args);

            if (throws) {
                writer.writeLine("const error = createRef<NativeHandle | null>(null);");
            }

            for (const hidden of hiddenOuts) {
                this.writeHiddenOutDeclaration(writer, hidden);
            }

            writer.write("const ptr = ");
            callWriter(writer);
            writer.writeLine(";");

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

    private addTypeImport(imp: import("../type-system/ffi-types.js").TypeImport): void {
        if (!imp.isExternal && this.selfNames.has(imp.transformedName)) return;
        if (imp.isExternal) {
            this.imports.addNamespaceImport(`../${imp.namespace.toLowerCase()}/index.js`, imp.namespace);
            return;
        }
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

    /**
     * Processes type imports from a MappedType, adding them via the ImportCollector.
     */
    private addTypeImportsFromMapping(mapped: MappedType): void {
        for (const imp of mapped.imports) {
            this.addTypeImport(imp);
        }
    }
}
