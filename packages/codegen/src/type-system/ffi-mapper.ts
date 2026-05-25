/**
 * FFI Type Mapper
 *
 * Maps normalized GIR types to TypeScript and FFI representations.
 * Works with the new GirRepository API and returns imports directly
 * instead of using callbacks.
 */

import type { GirCallback, GirField, GirNamespace, GirParameter, GirRepository, GirType } from "../gir/index.js";
import { isIntrinsicType, isStringType } from "../gir/index.js";
import { normalizeClassName, toCamelCase, toPascalCase, toValidIdentifier } from "../utils/naming.js";
import { splitQualifiedName } from "../utils/qualified-name.js";
import { canAllocateRecord, canMarshalRecord } from "../utils/record-filter.js";
import {
    arrayType,
    boxedType,
    byteArrayType,
    enumType,
    FFI_INT32,
    FFI_POINTER,
    FFI_UINT32,
    FFI_VOID,
    type FfiOwnership,
    type FfiTypeDescriptor,
    flagsType,
    fundamentalType,
    gArrayType,
    getFfiTypeByteSize,
    getPrimitiveTypeSize,
    gobjectType,
    hashTableType,
    type ImportType,
    isPrimitiveFieldType,
    type MappedType,
    PRIMITIVE_TYPE_MAP,
    ptrArrayType,
    refType,
    STRUCT_ELEMENT_SIZES,
    stringType,
    structType,
    type TypeImport,
    trampolineType,
    UNSAFE_PRIMITIVE_NAMES,
} from "./ffi-types.js";

/**
 * Maps normalized GIR types to TypeScript and FFI representations.
 *
 * Works with GirType from GirRepository and returns type mappings
 * including TypeScript type strings, FFI descriptors, and required imports.
 *
 * @example
 * ```typescript
 * const repo = new GirRepository();
 * await repo.loadFromDirectory("./girs");
 * repo.resolve();
 *
 * const mapper = new FfiMapper(repo, "Gtk");
 * const result = mapper.mapType(someNormalizedType);
 * // result.ts = "Button"
 * // result.ffi = { type: "gobject", ownership: "borrowed" }
 * // result.imports = [{ kind: "class", name: "Button", ... }]
 * ```
 */
const signedFallback = (signed: boolean) => (signed ? FFI_INT32 : FFI_UINT32);

export class FfiMapper {
    private readonly skippedClasses = new Set<string>();
    private readonly structSizeCache = new Map<string, number>();
    private readonly structAlignmentCache = new Map<string, number>();

    constructor(
        private readonly repo: GirRepository,
        private readonly currentNamespace: string,
    ) {}

    /** The namespace whose bindings are currently being generated. */
    getCurrentNamespace(): string {
        return this.currentNamespace;
    }

    /**
     * Enriches a struct FFI descriptor with its computed size.
     * Used for trampoline callback arguments where the native module needs
     * the size to copy struct data from raw pointers.
     */
    enrichStructWithSize(ffi: FfiTypeDescriptor, typeName: string): FfiTypeDescriptor {
        if (ffi.type !== "struct" || typeof ffi.innerType !== "string" || ffi.size !== undefined) {
            return ffi;
        }
        const resolved = typeName.includes(".")
            ? splitQualifiedName(typeName)
            : { namespace: this.currentNamespace, name: typeName };
        const size = this.calculateRecordSize(resolved.name, resolved.namespace);
        if (size !== undefined) {
            return { ...ffi, size };
        }
        return ffi;
    }

    /**
     * Maps a normalized type to TypeScript and FFI representations.
     *
     * @param type - The normalized type to map
     * @param isReturn - Whether this is a return type (affects ownership)
     * @param parentTransferOwnership - Transfer ownership from parent context
     * @param sizeParamOffset - Offset to add to sizeParamIndex for sized arrays (e.g., 1 for instance methods)
     * @returns Mapped type with TypeScript string, FFI descriptor, and required imports
     */
    private mapHashTableType(
        type: GirType,
        isReturn: boolean,
        parentTransferOwnership: string | undefined,
        imports: TypeImport[],
    ): MappedType {
        const keyType = type.getKeyType();
        const valueType = type.getValueType();
        const ownership = this.computeOwnership(isReturn, type.transferOwnership ?? parentTransferOwnership);

        if (keyType && valueType) {
            const elementTransfer = this.deriveElementTransfer(type.transferOwnership ?? parentTransferOwnership);
            const keyResult = this.mapType(keyType, isReturn, elementTransfer);
            const valueResult = this.mapType(valueType, isReturn, elementTransfer);
            imports.push(...keyResult.imports, ...valueResult.imports);

            return withInheritedUnsafe(
                {
                    ts: `Map<${keyResult.ts}, ${valueResult.ts}>`,
                    ffi: hashTableType(keyResult.ffi, valueResult.ffi, ownership),
                    imports,
                },
                keyResult,
                valueResult,
            );
        }

        return {
            ts: "Map<unknown, unknown>",
            ffi: hashTableType(FFI_POINTER, FFI_POINTER, ownership),
            imports,
            unsafe: true,
        };
    }

    private resolveArrayListType(type: GirType): "glist" | "gslist" | "sized" | "fixed" | undefined {
        if (type.fixedSize !== undefined) return "fixed";
        const isSizedArray =
            type.sizeParamIndex !== undefined && (type.zeroTerminated === false || type.zeroTerminated === undefined);
        if (isSizedArray) return "sized";
        if (type.isList()) return type.containerType as "glist" | "gslist";
        if (type.cType?.includes("GSList")) return "gslist";
        if (type.cType?.includes("GList")) return "glist";
        return undefined;
    }

    private mapArrayType(opts: {
        type: GirType;
        isReturn: boolean;
        parentTransferOwnership: string | undefined;
        sizeParamOffset: number;
        imports: TypeImport[];
    }): MappedType {
        const { type, isReturn, parentTransferOwnership, sizeParamOffset, imports } = opts;
        const ownership = this.computeOwnership(isReturn, type.transferOwnership ?? parentTransferOwnership);
        const listType = this.resolveArrayListType(type);
        const adjustedSizeParamIndex =
            type.sizeParamIndex === undefined ? undefined : type.sizeParamIndex + sizeParamOffset;

        if (!type.elementType) {
            return {
                ts: "unknown[]",
                ffi: arrayType(FFI_VOID, listType, ownership, {
                    sizeParamIndex: adjustedSizeParamIndex,
                    fixedSize: type.fixedSize,
                }),
                imports,
                unsafe: true,
            };
        }

        const elementTransferOwnership = this.deriveElementTransfer(type.transferOwnership ?? parentTransferOwnership);
        const elementResult = this.mapType(type.elementType, isReturn, elementTransferOwnership, sizeParamOffset);
        imports.push(...elementResult.imports);
        const elementSize = this.resolveInlineElementSize(type.elementType);

        return withInheritedUnsafe(
            {
                ts: `${elementResult.ts}[]`,
                ffi: arrayType(elementResult.ffi, listType, ownership, {
                    sizeParamIndex: adjustedSizeParamIndex,
                    fixedSize: type.fixedSize,
                    elementSize,
                }),
                imports,
                itemKind: elementResult.kind,
            },
            elementResult,
        );
    }

    mapType(type: GirType, isReturn = false, parentTransferOwnership?: string, sizeParamOffset = 0): MappedType {
        const imports: TypeImport[] = [];

        if (type.isHashTable()) {
            return this.mapHashTableType(type, isReturn, parentTransferOwnership, imports);
        }

        if (type.isPtrArray() || type.isGArray() || type.isByteArray()) {
            return this.mapGLibArrayContainer(type, isReturn, parentTransferOwnership, imports);
        }

        if (type.isArray) {
            return this.mapArrayType({ type, isReturn, parentTransferOwnership, sizeParamOffset, imports });
        }

        if (isStringType(type.name)) {
            return this.mapStringType(type, isReturn, parentTransferOwnership, imports);
        }

        const primitive = PRIMITIVE_TYPE_MAP.get(type.name);
        if (primitive) {
            return this.mapPrimitiveType(type, primitive, imports);
        }

        const resolved = this.resolveType(type.name);
        if (resolved) {
            const effectiveTransferOwnership = type.transferOwnership ?? parentTransferOwnership;
            return this.mapResolvedType(resolved, isReturn, imports, effectiveTransferOwnership);
        }

        return {
            ts: "number",
            ffi: FFI_POINTER,
            imports,
            unsafe: true,
        };
    }

    private mapStringType(
        type: GirType,
        isReturn: boolean,
        parentTransferOwnership: string | undefined,
        imports: TypeImport[],
    ): MappedType {
        const effectiveTransferOwnership = type.transferOwnership ?? parentTransferOwnership;
        return {
            ts: "string",
            ffi: stringType(this.computeOwnership(isReturn, effectiveTransferOwnership)),
            imports,
        };
    }

    private mapPrimitiveType(
        type: GirType,
        primitive: { ts: string; ffi: FfiTypeDescriptor },
        imports: TypeImport[],
    ): MappedType {
        if (type.name === "GType") {
            const isExternal = this.currentNamespace !== "GObject";
            imports.push({
                kind: "alias",
                name: "GType",
                namespace: "GObject",
                transformedName: "GType",
                isExternal,
            });
            return {
                ts: isExternal ? "GObject.GType" : "GType",
                ffi: primitive.ffi,
                imports,
            };
        }
        const base: MappedType = { ...primitive, imports };
        return UNSAFE_PRIMITIVE_NAMES.has(type.name) ? { ...base, unsafe: true } : base;
    }

    /**
     * Maps a normalized parameter to TypeScript and FFI representations.
     *
     * Handles special cases like out parameters, callbacks, and
     * ownership transfer.
     *
     * @param param - The parameter to map
     * @param sizeParamOffset - Offset to add to sizeParamIndex for sized arrays (e.g., 1 for instance methods)
     */
    private mapOutOrInoutParameter(param: GirParameter, sizeParamOffset: number, imports: TypeImport[]): MappedType {
        const innerType = this.mapType(param.type, false, param.transferOwnership, sizeParamOffset);
        imports.push(...innerType.imports);

        const isBoxedOrGObjectOrStruct =
            innerType.ffi.type === "boxed" || innerType.ffi.type === "gobject" || innerType.ffi.type === "struct";

        const passHandleDirectly =
            (param.callerAllocates && isBoxedOrGObjectOrStruct) ||
            (param.direction === "inout" && isBoxedOrGObjectOrStruct);

        if (passHandleDirectly) {
            return withInheritedUnsafe(
                {
                    ts: innerType.ts,
                    ffi: { ...innerType.ffi, ownership: "borrowed" as const },
                    imports,
                    kind: innerType.kind,
                },
                innerType,
            );
        }

        return withInheritedUnsafe(
            {
                ts: `Ref<${innerType.ts}>`,
                ffi: refType(innerType.ffi),
                imports,
                kind: innerType.kind,
                itemKind: innerType.itemKind,
                innerTsType: innerType.ts,
            },
            innerType,
        );
    }

    private adjustObjectOwnershipForParam(mapped: MappedType, param: GirParameter): MappedType {
        const isObjectType = mapped.ffi.type === "gobject" || mapped.ffi.type === "boxed";
        if (!isObjectType) return mapped;

        const isTransferFull = param.transferOwnership === "full" || param.transferOwnership === "container";
        if (isTransferFull) {
            return withInheritedUnsafe(
                {
                    ts: mapped.ts,
                    ffi: { ...mapped.ffi, ownership: "full" as const },
                    imports: mapped.imports,
                    kind: mapped.kind,
                },
                mapped,
            );
        }

        const isTransferNone = param.transferOwnership === "none" || param.transferOwnership === undefined;
        if (isTransferNone) {
            return withInheritedUnsafe(
                {
                    ts: mapped.ts,
                    ffi: { ...mapped.ffi, ownership: "borrowed" as const },
                    imports: mapped.imports,
                    kind: mapped.kind,
                },
                mapped,
            );
        }

        return mapped;
    }

    mapParameter(param: GirParameter, sizeParamOffset = 0): MappedType {
        const imports: TypeImport[] = [];

        if (param.direction === "out" || param.direction === "inout") {
            return this.mapOutOrInoutParameter(param, sizeParamOffset, imports);
        }

        const qualifiedCallbackName = this.qualifyTypeName(param.type.name);
        const callbackResult = this.mapCallback(qualifiedCallbackName, imports);
        if (callbackResult) {
            if (callbackResult.ffi.type === "trampoline" && param.destroy !== undefined) {
                callbackResult.ffi.hasDestroy = true;
            }
            if (callbackResult.ffi.type === "trampoline" && param.scope) {
                callbackResult.ffi.scope = param.scope;
            }
            return callbackResult;
        }

        if (param.type.name === "GLib.Closure") {
            return {
                ts: "(...args: unknown[]) => unknown",
                ffi: { type: "callback", kind: "closure", argTypes: [], returnType: { type: "void" } },
                imports,
                unsafe: true,
            };
        }

        const mapped = this.mapType(param.type, false, param.transferOwnership, sizeParamOffset);
        return this.adjustObjectOwnershipForParam(mapped, param);
    }

    /**
     * Checks if a parameter is a closure target (user_data or destroy notify).
     * Closure targets are associated with supported callback parameters.
     */
    isClosureTarget(param: GirParameter, allParams: readonly GirParameter[]): boolean {
        const paramIndex = allParams.indexOf(param);
        return allParams.some((p) => {
            return this.isCallback(p.type.name) && (p.closure === paramIndex || p.destroy === paramIndex);
        });
    }

    /**
     * Checks if a parameter is nullable.
     */
    isNullable(param: GirParameter): boolean {
        return param.nullable || param.optional;
    }

    /**
     * Checks if a parameter has a type the native marshaling layer cannot
     * safely handle (raw pointers, untyped containers, callback typedefs used
     * as type references, or composites whose inner types are unsafe).
     */
    hasUnsupportedCallback(param: GirParameter): boolean {
        return this.mapParameter(param).unsafe === true;
    }

    private resolveCallbackForParam(param: GirParameter): GirCallback | null {
        if (!this.isCallback(param.type.name)) return null;
        return this.repo.resolveCallback(this.qualifyTypeName(param.type.name)) ?? null;
    }

    getCallbackParamMappings(param: GirParameter): Array<{ name: string; mapped: MappedType }> | null {
        const callback = this.resolveCallbackForParam(param);
        if (!callback) return null;

        return callback.parameters
            .filter((p) => p.name !== "user_data" && p.name !== "data")
            .map((p) => ({
                name: p.name,
                mapped: this.mapType(p.type, false, p.transferOwnership),
            }));
    }

    getCallbackReturnType(param: GirParameter): MappedType | null {
        const callback = this.resolveCallbackForParam(param);
        if (!callback) return null;

        return this.mapType(callback.returnType, true, callback.returnType.transferOwnership);
    }

    /**
     * Registers a class as skipped (won't be generated).
     */
    registerSkippedClass(name: string): void {
        this.skippedClasses.add(name);
    }

    /**
     * Clears the skipped classes set.
     */
    clearSkippedClasses(): void {
        this.skippedClasses.clear();
    }

    /**
     * Checks whether a record has a no-arg JS constructor synthesized by
     * the record generator.
     *
     * Captures the size-computability requirement of
     * `RecordGenerator.generateConstructors`: the record must not be a
     * class vtable, must have at least one top-level field, and (when not
     * a boxed type) must have at least one non-opaque public field.
     */
    canAllocateLocally(typeName: string): boolean {
        const resolved = typeName.includes(".")
            ? splitQualifiedName(typeName)
            : { namespace: this.currentNamespace, name: typeName };
        const ns = this.repo.getNamespace(resolved.namespace);
        if (!ns) return false;
        const record = ns.records.get(resolved.name);
        if (record) return canAllocateRecord(record);

        const aliasTarget = ns.aliases.get(resolved.name)?.targetType.name;
        if (typeof aliasTarget === "string" && aliasTarget !== typeName) {
            return this.canAllocateLocally(aliasTarget);
        }
        return false;
    }

    /**
     * Finds a zero-argument factory `<function>` that constructs a value of
     * `typeName` (e.g. `hb_map_create` for `HarfBuzz.map_t`).
     *
     * Opaque records have no allocatable layout, but many libraries expose a
     * `<type>_create` function that constructs an instance. The shape builder
     * uses this to surface caller-allocates out parameters of such types as
     * returns rather than caller-supplied arguments.
     *
     * The factory must reside in the same namespace as the type, so the
     * generated module exposes it as a sibling export the body can call
     * directly.
     *
     * @param typeName - The record type name, optionally namespace-qualified.
     * @returns The factory's generated member name, or `null` when none exists.
     */
    findFactoryCIdentifier(typeName: string): string | null {
        const resolved = typeName.includes(".")
            ? splitQualifiedName(typeName)
            : { namespace: this.currentNamespace, name: typeName };
        if (resolved.namespace !== this.currentNamespace) return null;
        const ns = this.repo.getNamespace(resolved.namespace);
        if (!ns) return null;
        const baseName = resolved.name.endsWith("_t") ? resolved.name.slice(0, -2) : resolved.name;
        const factoryGirName = `${baseName}_create`;
        const factory = ns.functions.get(factoryGirName);
        if (!factory || factory.parameters.length > 0) return null;
        const returnName = String(factory.returnType.name);
        if (returnName !== resolved.name && !returnName.endsWith(`.${resolved.name}`)) return null;
        return toCamelCase(factoryGirName);
    }

    /**
     * Checks if a type is a callback.
     */
    isCallback(typeName: string): boolean {
        if (typeName.includes(".")) {
            const { namespace, name } = splitQualifiedName(typeName);
            const ns = this.repo.getNamespace(namespace);
            return ns?.callbacks.has(name) ?? false;
        }

        const ns = this.repo.getNamespace(this.currentNamespace);
        return ns?.callbacks.has(typeName) ?? false;
    }

    private qualifyTypeName(typeName: string): string {
        if (typeName.includes(".")) {
            return typeName;
        }
        return `${this.currentNamespace}.${typeName}`;
    }

    private resolveFromNamespace(
        ns: GirNamespace,
        name: string,
        namespace: string,
        isExternal: boolean,
    ): ResolvedType | null {
        return (
            resolveClassEntry(ns, name, namespace, isExternal) ??
            resolveInterfaceEntry(ns, name, namespace, isExternal) ??
            resolveRecordEntry(ns, name, namespace, isExternal) ??
            resolveEnumEntry(ns, name, namespace, isExternal) ??
            resolveBitfieldEntry(ns, name, namespace, isExternal) ??
            resolveCallbackEntry(ns, name, namespace, isExternal) ??
            this.resolveAliasEntry(ns, name, namespace, isExternal)
        );
    }

    private resolveAliasEntry(
        ns: GirNamespace,
        name: string,
        namespace: string,
        isExternal: boolean,
    ): ResolvedType | null {
        const alias = ns.aliases?.get(name);
        if (!alias) return null;
        const targetTypeName = alias.targetType.name;
        if (typeof targetTypeName === "string" && !targetTypeName.includes(".")) {
            return this.resolveFromNamespace(ns, targetTypeName, namespace, isExternal);
        }
        if (typeof targetTypeName === "string" && targetTypeName.includes(".")) {
            return this.resolveQualifiedType(targetTypeName);
        }
        return null;
    }

    private resolveType(typeName: string): ResolvedType | null {
        if (isIntrinsicType(typeName)) {
            return null;
        }

        if (typeName.includes(".")) {
            return this.resolveQualifiedType(typeName);
        }

        const ns = this.repo.getNamespace(this.currentNamespace);
        if (!ns) return null;

        const resolved = this.resolveFromNamespace(ns, typeName, this.currentNamespace, false);
        if (resolved) return resolved;

        for (const [nsName, namespace] of this.repo.getAllNamespaces()) {
            if (nsName === this.currentNamespace) continue;

            const externalResolved = this.resolveFromNamespace(namespace, typeName, nsName, true);
            if (externalResolved) return externalResolved;
        }

        return null;
    }

    private resolveQualifiedType(qualifiedName: string): ResolvedType | null {
        const { namespace, name } = splitQualifiedName(qualifiedName);
        const ns = this.repo.getNamespace(namespace);
        if (!ns) return null;

        const isExternal = namespace !== this.currentNamespace;
        return this.resolveFromNamespace(ns, name, namespace, isExternal);
    }

    /**
     * Maps a GIR `transfer-ownership` annotation to the FFI ownership tag.
     * `transfer-full` and `transfer-container` produce `"full"`; everything
     * else falls back to a defensive `"borrowed"` for returns and an owning
     * `"full"` for parameters. The `"none"` tag is reserved for hand-written
     * descriptors that intentionally skip the defensive copy (e.g. the
     * `cairo_path_t` wrapper with its `freeFn`-equipped boxed) and is never
     * emitted by codegen.
     */
    private computeOwnership(isReturn: boolean, transferOwnership?: string): FfiOwnership {
        if (transferOwnership === "full" || transferOwnership === "container") return "full";
        if (transferOwnership === "none") return "borrowed";
        return isReturn ? "borrowed" : "full";
    }

    private deriveElementTransfer(parentTransfer?: string): string | undefined {
        if (parentTransfer === "container") return "none";
        return parentTransfer;
    }

    private mapEnumOrFlagsResolved(resolved: ResolvedType, qualifiedName: string, imports: TypeImport[]): MappedType {
        const sharedLib = this.repo.getNamespace(resolved.namespace)?.sharedLibrary;
        const signed = resolved.signed ?? false;
        const factory = resolved.kind === "enum" ? enumType : flagsType;
        return {
            ts: qualifiedName,
            ffi:
                resolved.glibGetType && sharedLib
                    ? factory(sharedLib, resolved.glibGetType, signed)
                    : signedFallback(signed),
            imports,
            kind: resolved.kind,
        };
    }

    private mapRecordResolved(
        resolved: ResolvedType,
        qualifiedName: string,
        ownership: FfiOwnership,
        imports: TypeImport[],
    ): MappedType {
        const record = this.repo.getNamespace(resolved.namespace)?.records.get(resolved.name);
        if (record && !canMarshalRecord(record, this.repo, resolved.namespace)) {
            return {
                ts: "unknown",
                ffi: structType(resolved.transformedName, ownership),
                imports: [],
                kind: "record",
                unsafe: true,
            };
        }

        if (resolved.isFundamental && resolved.copyFunction && resolved.freeFunction) {
            const sharedLib = this.repo.getNamespace(resolved.namespace)?.sharedLibrary;
            if (sharedLib) {
                return {
                    ts: qualifiedName,
                    ffi: fundamentalType({
                        lib: sharedLib,
                        refFn: resolved.copyFunction,
                        unrefFn: resolved.freeFunction,
                        ownership,
                        typeName: resolved.glibTypeName,
                    }),
                    imports,
                    kind: "record",
                };
            }
        }

        const { glibTypeName, glibGetType } = resolved;
        if (!glibTypeName || !glibGetType) {
            return {
                ts: qualifiedName,
                ffi: structType(resolved.transformedName, ownership),
                imports,
                kind: "record",
            };
        }

        const sharedLib = this.repo.getNamespace(resolved.namespace)?.sharedLibrary;
        return {
            ts: qualifiedName,
            ffi: boxedType(glibTypeName, ownership, sharedLib, glibGetType),
            imports,
            kind: "record",
        };
    }

    private mapClassOrInterfaceResolved(
        resolved: ResolvedType,
        qualifiedName: string,
        ownership: FfiOwnership,
        imports: TypeImport[],
    ): MappedType {
        if (resolved.isFundamental && resolved.refFunc && resolved.unrefFunc) {
            const sharedLib = this.repo.getNamespace(resolved.namespace)?.sharedLibrary;
            if (sharedLib) {
                return {
                    ts: qualifiedName,
                    ffi: fundamentalType({
                        lib: sharedLib,
                        refFn: resolved.refFunc,
                        unrefFn: resolved.unrefFunc,
                        ownership,
                        typeName: resolved.glibTypeName,
                    }),
                    imports,
                    kind: resolved.kind,
                };
            }
        }

        return {
            ts: qualifiedName,
            ffi: gobjectType(ownership),
            imports,
            kind: resolved.kind,
        };
    }

    private mapResolvedType(
        resolved: ResolvedType,
        isReturn: boolean,
        imports: TypeImport[],
        transferOwnership?: string,
    ): MappedType {
        const qualifiedName = resolved.isExternal
            ? `${resolved.namespace}.${resolved.transformedName}`
            : resolved.transformedName;

        if ((resolved.kind === "class" || resolved.kind === "interface") && this.skippedClasses.has(resolved.name)) {
            return {
                ts: "unknown",
                ffi: gobjectType(this.computeOwnership(isReturn, transferOwnership)),
                imports,
                unsafe: true,
            };
        }

        imports.push({
            kind: resolved.kind,
            name: resolved.name,
            namespace: resolved.namespace,
            transformedName: resolved.transformedName,
            isExternal: resolved.isExternal,
        });

        return this.dispatchResolvedType({ resolved, qualifiedName, isReturn, imports, transferOwnership });
    }

    private dispatchResolvedType(opts: {
        resolved: ResolvedType;
        qualifiedName: string;
        isReturn: boolean;
        imports: TypeImport[];
        transferOwnership: string | undefined;
    }): MappedType {
        const { resolved, qualifiedName, isReturn, imports, transferOwnership } = opts;
        switch (resolved.kind) {
            case "enum":
            case "flags":
                return this.mapEnumOrFlagsResolved(resolved, qualifiedName, imports);

            case "record":
                return this.mapRecordResolved(
                    resolved,
                    qualifiedName,
                    this.computeOwnership(isReturn, transferOwnership),
                    imports,
                );

            case "callback":
                return {
                    ts: "number",
                    ffi: FFI_POINTER,
                    imports,
                    kind: "callback",
                    unsafe: true,
                };

            case "class":
            case "interface":
                return this.mapClassOrInterfaceResolved(
                    resolved,
                    qualifiedName,
                    this.computeOwnership(isReturn, transferOwnership),
                    imports,
                );

            case "alias":
                throw new Error(
                    `Alias kind reached mapResolvedType for ${qualifiedName}; aliases must be intercepted earlier.`,
                );
        }
    }

    private mapCallback(qualifiedName: string, imports: TypeImport[]): MappedType | null {
        const callback = this.repo.resolveCallback(qualifiedName);
        if (!callback) {
            return null;
        }

        const params = this.buildCallbackTsParams(callback, imports);
        const returnPart = this.buildCallbackTsReturn(callback.returnType, imports);
        const ts = `(${params.parts.join(", ")}) => ${returnPart.ts}`;
        const ffi = this.buildTrampolineFfiDescriptor(callback);

        const result: MappedType = { ts, ffi, imports };
        return params.unsafe || returnPart.unsafe ? { ...result, unsafe: true } : result;
    }

    private buildCallbackTsParams(callback: GirCallback, imports: TypeImport[]): { parts: string[]; unsafe: boolean } {
        const parts: string[] = [];
        let unsafe = false;

        for (const param of callback.parameters) {
            if (param.name === "user_data" || param.name === "data") continue;

            const mapped = this.mapType(param.type, false, param.transferOwnership);
            imports.push(...mapped.imports);
            if (mapped.unsafe === true) unsafe = true;

            const nullable = param.nullable ? " | null" : "";
            const paramName = toValidIdentifier(toCamelCase(param.name));
            parts.push(`${paramName}: ${mapped.ts}${nullable}`);
        }

        return { parts, unsafe };
    }

    private buildCallbackTsReturn(returnType: GirType, imports: TypeImport[]): { ts: string; unsafe: boolean } {
        if (returnType.name === "none" || returnType.name === "void") {
            return { ts: "void", unsafe: false };
        }
        const mapped = this.mapType(returnType, true, returnType.transferOwnership);
        imports.push(...mapped.imports);
        const nullable = returnType.nullable ? " | null" : "";
        return { ts: `${mapped.ts}${nullable}`, unsafe: mapped.unsafe === true };
    }

    private buildTrampolineFfiDescriptor(callback: GirCallback): FfiTypeDescriptor {
        let userDataIndex: number | undefined;
        const argTypes: FfiTypeDescriptor[] = [];

        for (const [i, p] of callback.parameters.entries()) {
            if (p.name === "user_data" || p.name === "data") {
                userDataIndex = i;
            }
            const mapped = this.mapType(p.type, false, p.transferOwnership);
            argTypes.push(this.enrichStructWithSize(mapped.ffi, String(p.type.name)));
        }

        const hasReturn = callback.returnType.name !== "none" && callback.returnType.name !== "void";
        const returnType = hasReturn
            ? this.mapType(callback.returnType, true, callback.returnType.transferOwnership).ffi
            : FFI_VOID;

        return trampolineType(argTypes, returnType, undefined, userDataIndex);
    }

    private mapGLibArrayContainer(
        type: GirType,
        isReturn: boolean,
        parentTransferOwnership: string | undefined,
        imports: TypeImport[],
    ): MappedType {
        const isGArray = type.isGArray();
        const isByteArray = type.isByteArray();
        const ownership = this.computeOwnership(isReturn, type.transferOwnership ?? parentTransferOwnership);

        if (isByteArray) {
            return { ts: "number[]", ffi: byteArrayType(ownership), imports };
        }

        if (type.elementType) {
            const elementTransferOwnership = this.deriveElementTransfer(
                type.transferOwnership ?? parentTransferOwnership,
            );
            const elementResult = this.mapType(type.elementType, isReturn, elementTransferOwnership);
            imports.push(...elementResult.imports);

            const ffi = isGArray
                ? gArrayType(elementResult.ffi, this.getElementSize(type.elementType), ownership)
                : ptrArrayType(elementResult.ffi, ownership);

            return withInheritedUnsafe({ ts: `${elementResult.ts}[]`, ffi, imports }, elementResult);
        }

        const fallbackFfi = isGArray ? gArrayType(FFI_POINTER, 8, ownership) : ptrArrayType(FFI_POINTER, ownership);

        return { ts: "unknown[]", ffi: fallbackFfi, imports, unsafe: true };
    }

    private resolveInlineElementSize(elementType: GirType): number | undefined {
        const known = STRUCT_ELEMENT_SIZES.get(elementType.name);
        if (known !== undefined) return known;

        if (elementType.cType?.includes("*")) return undefined;

        const qualified = elementType.name?.includes(".")
            ? splitQualifiedName(elementType.name)
            : { namespace: this.currentNamespace, name: elementType.name };
        if (!qualified.name) return undefined;

        return this.calculateRecordSize(qualified.name, qualified.namespace);
    }

    private calculateRecordSize(name: string, namespace: string): number | undefined {
        const cacheKey = `${namespace}.${name}`;
        const cached = this.structSizeCache.get(cacheKey);
        if (cached !== undefined) return cached;

        const ns = this.repo.getNamespace(namespace);
        const record = ns?.records.get(name);
        if (!record || record.opaque || record.disguised || record.fields.length === 0) {
            return undefined;
        }

        this.structSizeCache.set(cacheKey, 0);
        const size = this.computeStructSize(record.fields, namespace, record.isUnion);
        if (size > 0) {
            this.structSizeCache.set(cacheKey, size);
            return size;
        }
        this.structSizeCache.delete(cacheKey);
        return undefined;
    }

    private computeStructSize(fields: readonly GirField[], namespace: string, isUnion: boolean): number {
        let rawSize = 0;
        let maxAlignment = 1;

        for (const field of fields) {
            const size = this.getFieldByteSize(field, namespace);
            const alignment = this.getFieldAlignment(field, namespace);

            if (isUnion) {
                rawSize = Math.max(rawSize, size);
            } else {
                rawSize = Math.ceil(rawSize / alignment) * alignment + size;
            }
            maxAlignment = Math.max(maxAlignment, alignment);
        }

        return Math.ceil(rawSize / maxAlignment) * maxAlignment;
    }

    private getFieldByteSize(field: GirField, namespace: string): number {
        const composite = field.inlineComposite;
        if (composite) {
            return this.computeStructSize(composite.fields, namespace, composite.isUnion);
        }

        const type = field.type;
        if (type.cType?.includes("*")) return 8;
        if (this.isCallbackType(type.name, namespace)) return 8;

        if (type.isArray && type.fixedSize !== undefined && type.elementType) {
            const elemSize = this.getTypePrimitiveSize(type.elementType.name, namespace);
            return elemSize * type.fixedSize;
        }

        return this.getTypePrimitiveSize(type.name, namespace);
    }

    private getFieldAlignment(field: GirField, namespace: string): number {
        const composite = field.inlineComposite;
        if (composite) {
            let alignment = 1;
            for (const inner of composite.fields) {
                alignment = Math.max(alignment, this.getFieldAlignment(inner, namespace));
            }
            return alignment;
        }

        const type = field.type;
        if (type.cType?.includes("*")) return 8;
        if (this.isCallbackType(type.name, namespace)) return 8;

        if (type.isArray && type.fixedSize !== undefined && type.elementType) {
            return this.getTypeAlignment(type.elementType.name, namespace);
        }

        return this.getTypeAlignment(type.name, namespace);
    }

    private getTypeAlignment(typeName: string, namespace: string): number {
        if (isPrimitiveFieldType(typeName)) {
            return getPrimitiveTypeSize(typeName);
        }

        const resolvedName = typeName.includes(".") ? typeName : `${namespace}.${typeName}`;
        const parts = splitQualifiedName(resolvedName);
        const cacheKey = `${parts.namespace}.${parts.name}`;
        const cached = this.structAlignmentCache.get(cacheKey);
        if (cached !== undefined) return cached;

        const ns = this.repo.getNamespace(parts.namespace);
        const record = ns?.records.get(parts.name);
        if (record && !record.opaque && !record.disguised && record.fields.length > 0) {
            let maxAlign = 1;
            for (const f of record.fields) {
                maxAlign = Math.max(maxAlign, this.getFieldAlignment(f, parts.namespace));
            }
            this.structAlignmentCache.set(cacheKey, maxAlign);
            return maxAlign;
        }

        this.structAlignmentCache.set(cacheKey, 8);
        return 8;
    }

    private isCallbackType(typeName: string, namespace: string): boolean {
        if (typeName.includes(".")) {
            const parts = splitQualifiedName(typeName);
            const ns = this.repo.getNamespace(parts.namespace);
            return ns?.callbacks.has(parts.name) ?? false;
        }
        const ns = this.repo.getNamespace(namespace);
        return ns?.callbacks.has(typeName) ?? false;
    }

    private getTypePrimitiveSize(typeName: string, namespace: string): number {
        if (isPrimitiveFieldType(typeName)) {
            return getPrimitiveTypeSize(typeName);
        }

        const resolvedName = typeName.includes(".") ? typeName : `${namespace}.${typeName}`;
        const parts = splitQualifiedName(resolvedName);
        const ns = this.repo.getNamespace(parts.namespace);
        const record = ns?.records.get(parts.name);
        if (record && !record.opaque && !record.disguised && record.fields.length > 0) {
            const cacheKey = `${parts.namespace}.${parts.name}`;
            const cached = this.structSizeCache.get(cacheKey);
            if (cached !== undefined) return cached || 8;

            this.structSizeCache.set(cacheKey, 0);
            const size = this.computeStructSize(record.fields, parts.namespace, record.isUnion);
            if (size > 0) {
                this.structSizeCache.set(cacheKey, size);
                return size;
            }
            this.structSizeCache.delete(cacheKey);
        }

        return 8;
    }

    private getElementSize(type: GirType): number {
        if (type.isNumeric()) {
            const primitive = PRIMITIVE_TYPE_MAP.get(type.name);
            if (primitive) {
                return getFfiTypeByteSize(primitive.ffi.type);
            }
        }
        return 8;
    }
}

const resolveClassEntry = (
    ns: GirNamespace,
    name: string,
    namespace: string,
    isExternal: boolean,
): ResolvedType | null => {
    const cls = ns.classes.get(name);
    if (!cls) return null;
    return {
        kind: "class",
        name,
        namespace,
        transformedName: normalizeClassName(name),
        isExternal,
        glibTypeName: cls.glibTypeName,
        glibGetType: cls.glibGetType,
        isFundamental: cls.isFundamental(),
        refFunc: cls.refFunc,
        unrefFunc: cls.unrefFunc,
    };
};

const resolveInterfaceEntry = (
    ns: GirNamespace,
    name: string,
    namespace: string,
    isExternal: boolean,
): ResolvedType | null => {
    const iface = ns.interfaces.get(name);
    if (!iface) return null;
    return {
        kind: "interface",
        name,
        namespace,
        transformedName: normalizeClassName(name),
        isExternal,
        glibTypeName: iface.glibTypeName,
    };
};

const resolveRecordEntry = (
    ns: GirNamespace,
    name: string,
    namespace: string,
    isExternal: boolean,
): ResolvedType | null => {
    const record = ns.records.get(name);
    if (!record) return null;
    return {
        kind: "record",
        name,
        namespace,
        transformedName: normalizeClassName(name),
        isExternal,
        glibTypeName: record.glibTypeName,
        glibGetType: record.glibGetType,
        isPlainStruct: record.isPlainStruct(),
        isFundamental: record.isFundamental(),
        copyFunction: record.copyFunction,
        freeFunction: record.freeFunction,
    };
};

const resolveEnumEntry = (
    ns: GirNamespace,
    name: string,
    namespace: string,
    isExternal: boolean,
): ResolvedType | null => {
    const enumeration = ns.enumerations.get(name);
    if (!enumeration) return null;
    const signed = enumeration.members.some((m) => m.value.startsWith("-"));
    return {
        kind: "enum",
        name,
        namespace,
        transformedName: toPascalCase(name),
        isExternal,
        glibGetType: enumeration.glibGetType,
        signed,
    };
};

const resolveBitfieldEntry = (
    ns: GirNamespace,
    name: string,
    namespace: string,
    isExternal: boolean,
): ResolvedType | null => {
    const bitfield = ns.bitfields.get(name);
    if (!bitfield) return null;
    const signed = bitfield.members.some((m) => m.value.startsWith("-"));
    return {
        kind: "flags",
        name,
        namespace,
        transformedName: toPascalCase(name),
        isExternal,
        glibGetType: bitfield.glibGetType,
        signed,
    };
};

const resolveCallbackEntry = (
    ns: GirNamespace,
    name: string,
    namespace: string,
    isExternal: boolean,
): ResolvedType | null => {
    if (!ns.callbacks.has(name)) return null;
    return {
        kind: "callback",
        name,
        namespace,
        transformedName: toPascalCase(name),
        isExternal,
    };
};

/**
 * Internal type for resolved type information.
 */
type ResolvedType = {
    kind: ImportType;
    name: string;
    namespace: string;
    transformedName: string;
    isExternal: boolean;
    glibTypeName?: string;
    glibGetType?: string;
    isPlainStruct?: boolean;
    isFundamental?: boolean;
    refFunc?: string;
    unrefFunc?: string;
    copyFunction?: string;
    freeFunction?: string;
    signed?: boolean;
};

/**
 * Returns a {@link MappedType} marked unsafe iff any of the provided source
 * mappings is unsafe. Used to propagate the unsafe flag from inner element /
 * key / value / ref / callback mappings to the enclosing composite mapping.
 *
 * Requires at least one source so the contract — "outer is unsafe iff some
 * inner is unsafe" — is precise; passing zero sources would silently return
 * the input unchanged, masking call-site mistakes.
 */
const withInheritedUnsafe = (mapped: MappedType, source: MappedType, ...extra: MappedType[]): MappedType => {
    const inherited = source.unsafe === true || extra.some((s) => s.unsafe === true);
    return inherited ? { ...mapped, unsafe: true } : mapped;
};
