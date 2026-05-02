/**
 * FFI Type Mapper
 *
 * Maps normalized GIR types to TypeScript and FFI representations.
 * Works with the new GirRepository API and returns imports directly
 * instead of using callbacks.
 */

import type { GirCallback, GirField, GirNamespace, GirParameter, GirRepository, GirType } from "@gtkx/gir";
import { isIntrinsicType, isStringType } from "@gtkx/gir";
import { normalizeClassName, toCamelCase, toPascalCase, toValidIdentifier } from "../utils/naming.js";
import { splitQualifiedName } from "../utils/qualified-name.js";
import {
    arrayType,
    boxedType,
    byteArrayType,
    enumType,
    FFI_INT32,
    FFI_POINTER,
    FFI_UINT32,
    FFI_VOID,
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
        const transferFull = this.computeTransferFull(isReturn, type.transferOwnership ?? parentTransferOwnership);

        if (keyType && valueType) {
            const elementTransfer = this.deriveElementTransfer(type.transferOwnership ?? parentTransferOwnership);
            const keyResult = this.mapType(keyType, isReturn, elementTransfer);
            const valueResult = this.mapType(valueType, isReturn, elementTransfer);
            imports.push(...keyResult.imports, ...valueResult.imports);

            return {
                ts: `Map<${keyResult.ts}, ${valueResult.ts}>`,
                ffi: hashTableType(keyResult.ffi, valueResult.ffi, transferFull),
                imports,
            };
        }

        return {
            ts: "Map<unknown, unknown>",
            ffi: hashTableType(FFI_POINTER, FFI_POINTER, transferFull),
            imports,
        };
    }

    private resolveArrayListType(type: GirType): "glist" | "gslist" | "sized" | "fixed" | undefined {
        if (type.fixedSize !== undefined) return "fixed";
        const isSizedArray =
            type.sizeParamIndex !== undefined &&
            (type.zeroTerminated === false || type.zeroTerminated === undefined);
        if (isSizedArray) return "sized";
        if (type.isList()) return type.containerType as "glist" | "gslist";
        if (type.cType?.includes("GSList")) return "gslist";
        if (type.cType?.includes("GList")) return "glist";
        return undefined;
    }

    private mapArrayType(
        type: GirType,
        isReturn: boolean,
        parentTransferOwnership: string | undefined,
        sizeParamOffset: number,
        imports: TypeImport[],
    ): MappedType {
        const transferFull = this.computeTransferFull(isReturn, type.transferOwnership ?? parentTransferOwnership);
        const listType = this.resolveArrayListType(type);
        const adjustedSizeParamIndex =
            type.sizeParamIndex !== undefined ? type.sizeParamIndex + sizeParamOffset : undefined;

        if (!type.elementType) {
            return {
                ts: "unknown[]",
                ffi: arrayType(FFI_VOID, listType, transferFull, adjustedSizeParamIndex, type.fixedSize),
                imports,
            };
        }

        const elementTransferOwnership = this.deriveElementTransfer(
            type.transferOwnership ?? parentTransferOwnership,
        );
        const elementResult = this.mapType(type.elementType, isReturn, elementTransferOwnership, sizeParamOffset);
        imports.push(...elementResult.imports);
        const elementSize = STRUCT_ELEMENT_SIZES.get(type.elementType.name);

        return {
            ts: `${elementResult.ts}[]`,
            ffi: arrayType(
                elementResult.ffi,
                listType,
                transferFull,
                adjustedSizeParamIndex,
                type.fixedSize,
                elementSize,
            ),
            imports,
            itemKind: elementResult.kind,
        };
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
            return this.mapArrayType(type, isReturn, parentTransferOwnership, sizeParamOffset, imports);
        }

        if (isStringType(type.name)) {
            const effectiveTransferOwnership = type.transferOwnership ?? parentTransferOwnership;
            return {
                ts: "string",
                ffi: stringType(effectiveTransferOwnership !== "none"),
                imports,
            };
        }

        const primitive = PRIMITIVE_TYPE_MAP.get(type.name);
        if (primitive) {
            return { ...primitive, imports };
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
        };
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
            return {
                ts: innerType.ts,
                ffi: { ...innerType.ffi, ownership: "borrowed" as const },
                imports,
                kind: innerType.kind,
            };
        }

        return {
            ts: `Ref<${innerType.ts}>`,
            ffi: refType(innerType.ffi),
            imports,
            kind: innerType.kind,
            itemKind: innerType.itemKind,
            innerTsType: innerType.ts,
        };
    }

    private adjustObjectOwnershipForParam(mapped: MappedType, param: GirParameter): MappedType {
        const isObjectType = mapped.ffi.type === "gobject" || mapped.ffi.type === "boxed";
        if (!isObjectType) return mapped;

        const isTransferFull = param.transferOwnership === "full" || param.transferOwnership === "container";
        if (isTransferFull) {
            return {
                ts: mapped.ts,
                ffi: { ...mapped.ffi, ownership: "full" as const },
                imports: mapped.imports,
                kind: mapped.kind,
            };
        }

        const isTransferNone = param.transferOwnership === "none" || param.transferOwnership === undefined;
        if (isTransferNone) {
            return {
                ts: mapped.ts,
                ffi: { ...mapped.ffi, ownership: "borrowed" as const },
                imports: mapped.imports,
                kind: mapped.kind,
            };
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
                callbackResult.ffi.scope = param.scope as "call" | "notified" | "async";
            }
            return callbackResult;
        }

        if (param.type.name === "GLib.Closure") {
            return {
                ts: "(...args: unknown[]) => unknown",
                ffi: { type: "callback", kind: "closure", argTypes: [], returnType: { type: "void" } },
                imports,
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
     * Checks if a parameter has an unsupported callback type.
     * Supported callbacks are those with native implementations in NATIVE_CALLBACKS.
     */
    hasUnsupportedCallback(_param: GirParameter): boolean {
        return false;
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
     * Checks whether a boxed/struct record has a no-arg JS constructor
     * generated by the record generator.
     *
     * Mirrors the conditions used by `FfiGenerator.shouldGenerateRecord`
     * combined with the `RecordGenerator.generateConstructors` requirement
     * that a no-arg constructor is only synthesized when the record has at
     * least one top-level field (so the struct size is computable). Records
     * generated as opaque stubs, gtype structs, "Private" records, or
     * records whose fields are nested in unions all fail this check.
     */
    canAllocateLocally(typeName: string): boolean {
        const resolved = typeName.includes(".")
            ? splitQualifiedName(typeName)
            : { namespace: this.currentNamespace, name: typeName };
        const ns = this.repo.getNamespace(resolved.namespace);
        if (!ns) return false;
        const record = ns.records.get(resolved.name);
        if (!record) return false;
        if (record.disguised) return false;
        if (record.isGtypeStruct()) return false;
        if (record.name.endsWith("Private")) return false;
        if (record.fields.length === 0) return false;

        if (record.glibTypeName) return true;
        if (record.opaque) return false;
        const publicFields = record.getPublicFields();
        return publicFields.length > 0;
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
        const cls = ns.classes.get(name);
        if (cls) {
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
        }

        const iface = ns.interfaces.get(name);
        if (iface) {
            return {
                kind: "interface",
                name,
                namespace,
                transformedName: normalizeClassName(name),
                isExternal,
                glibTypeName: iface.glibTypeName,
            };
        }

        const record = ns.records.get(name);
        if (record) {
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
        }

        const enumeration = ns.enumerations.get(name);
        if (enumeration) {
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
        }

        const bitfield = ns.bitfields.get(name);
        if (bitfield) {
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
        }

        if (ns.callbacks.has(name)) {
            return {
                kind: "callback",
                name,
                namespace,
                transformedName: toPascalCase(name),
                isExternal,
            };
        }

        const alias = ns.aliases?.get(name);
        if (alias) {
            const targetTypeName = alias.targetType.name;
            if (typeof targetTypeName === "string" && !targetTypeName.includes(".")) {
                return this.resolveFromNamespace(ns, targetTypeName, namespace, isExternal);
            }
            if (typeof targetTypeName === "string" && targetTypeName.includes(".")) {
                return this.resolveQualifiedType(targetTypeName);
            }
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

    private computeTransferFull(isReturn: boolean, transferOwnership?: string): boolean {
        if (transferOwnership === "full" || transferOwnership === "container") return true;
        if (transferOwnership === "none") return false;
        return !isReturn;
    }

    private deriveElementTransfer(parentTransfer?: string): string | undefined {
        if (parentTransfer === "container") return "none";
        return parentTransfer;
    }

    private mapEnumOrFlagsResolved(
        resolved: ResolvedType,
        qualifiedName: string,
        imports: TypeImport[],
    ): MappedType {
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
        transferFull: boolean,
        imports: TypeImport[],
    ): MappedType {
        if (resolved.isFundamental && resolved.copyFunction && resolved.freeFunction) {
            const sharedLib = this.repo.getNamespace(resolved.namespace)?.sharedLibrary;
            if (sharedLib) {
                return {
                    ts: qualifiedName,
                    ffi: fundamentalType(
                        sharedLib,
                        resolved.copyFunction,
                        resolved.freeFunction,
                        transferFull,
                        resolved.glibTypeName,
                    ),
                    imports,
                    kind: "record",
                };
            }
        }

        const { glibTypeName, glibGetType } = resolved;
        if (!glibTypeName || !glibGetType) {
            return {
                ts: qualifiedName,
                ffi: structType(resolved.transformedName, transferFull),
                imports,
                kind: "record",
            };
        }

        const sharedLib = this.repo.getNamespace(resolved.namespace)?.sharedLibrary;
        return {
            ts: qualifiedName,
            ffi: boxedType(glibTypeName, transferFull, sharedLib, glibGetType),
            imports,
            kind: "record",
        };
    }

    private mapClassOrInterfaceResolved(
        resolved: ResolvedType,
        qualifiedName: string,
        transferFull: boolean,
        imports: TypeImport[],
    ): MappedType {
        if (resolved.isFundamental && resolved.refFunc && resolved.unrefFunc) {
            const sharedLib = this.repo.getNamespace(resolved.namespace)?.sharedLibrary;
            if (sharedLib) {
                return {
                    ts: qualifiedName,
                    ffi: fundamentalType(
                        sharedLib,
                        resolved.refFunc,
                        resolved.unrefFunc,
                        transferFull,
                        resolved.glibTypeName,
                    ),
                    imports,
                    kind: resolved.kind,
                };
            }
        }

        return {
            ts: qualifiedName,
            ffi: gobjectType(transferFull),
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
                ffi: gobjectType(this.computeTransferFull(isReturn, transferOwnership)),
                imports,
            };
        }

        imports.push({
            kind: resolved.kind,
            name: resolved.name,
            namespace: resolved.namespace,
            transformedName: resolved.transformedName,
            isExternal: resolved.isExternal,
        });

        switch (resolved.kind) {
            case "enum":
            case "flags":
                return this.mapEnumOrFlagsResolved(resolved, qualifiedName, imports);

            case "record":
                return this.mapRecordResolved(
                    resolved,
                    qualifiedName,
                    this.computeTransferFull(isReturn, transferOwnership),
                    imports,
                );

            case "callback":
                return {
                    ts: "number",
                    ffi: FFI_POINTER,
                    imports,
                    kind: "callback",
                };

            case "class":
            case "interface":
                return this.mapClassOrInterfaceResolved(
                    resolved,
                    qualifiedName,
                    this.computeTransferFull(isReturn, transferOwnership),
                    imports,
                );
        }
    }

    private mapCallback(qualifiedName: string, imports: TypeImport[]): MappedType | null {
        const callback = this.repo.resolveCallback(qualifiedName);
        if (!callback) {
            return null;
        }

        const tsParams = this.buildCallbackTsParams(callback, imports);
        const tsReturn = this.buildCallbackTsReturn(callback.returnType, imports);
        const ts = `(${tsParams.join(", ")}) => ${tsReturn}`;
        const ffi = this.buildTrampolineFfiDescriptor(callback);

        return { ts, ffi, imports };
    }

    private buildCallbackTsParams(callback: GirCallback, imports: TypeImport[]): string[] {
        const result: string[] = [];

        for (const param of callback.parameters) {
            if (param.name === "user_data" || param.name === "data") continue;

            const mapped = this.mapType(param.type, false, param.transferOwnership);
            imports.push(...mapped.imports);

            const nullable = param.nullable ? " | null" : "";
            const paramName = toValidIdentifier(toCamelCase(param.name));
            result.push(`${paramName}: ${mapped.ts}${nullable}`);
        }

        return result;
    }

    private buildCallbackTsReturn(returnType: GirType, imports: TypeImport[]): string {
        if (returnType.name === "none" || returnType.name === "void") {
            return "void";
        }
        const mapped = this.mapType(returnType, true, returnType.transferOwnership);
        imports.push(...mapped.imports);
        const nullable = returnType.nullable ? " | null" : "";
        return `${mapped.ts}${nullable}`;
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
        const transferFull = this.computeTransferFull(isReturn, type.transferOwnership ?? parentTransferOwnership);

        if (isByteArray) {
            return { ts: "number[]", ffi: byteArrayType(transferFull), imports };
        }

        if (type.elementType) {
            const elementTransferOwnership = this.deriveElementTransfer(
                type.transferOwnership ?? parentTransferOwnership,
            );
            const elementResult = this.mapType(type.elementType, isReturn, elementTransferOwnership);
            imports.push(...elementResult.imports);

            const ffi = isGArray
                ? gArrayType(elementResult.ffi, this.getElementSize(type.elementType), transferFull)
                : ptrArrayType(elementResult.ffi, transferFull);

            return { ts: `${elementResult.ts}[]`, ffi, imports };
        }

        const fallbackFfi = isGArray
            ? gArrayType(FFI_POINTER, 8, transferFull)
            : ptrArrayType(FFI_POINTER, transferFull);

        return { ts: "unknown[]", ffi: fallbackFfi, imports };
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
        const size = this.computeStructSize(record.fields, namespace);
        if (size > 0) {
            this.structSizeCache.set(cacheKey, size);
            return size;
        }
        this.structSizeCache.delete(cacheKey);
        return undefined;
    }

    private computeStructSize(fields: readonly GirField[], namespace: string): number {
        let currentOffset = 0;
        let maxAlignment = 1;

        for (const field of fields) {
            const size = this.getFieldByteSize(field, namespace);
            const alignment = this.getFieldAlignment(field, namespace);

            currentOffset = Math.ceil(currentOffset / alignment) * alignment;
            currentOffset += size;
            maxAlignment = Math.max(maxAlignment, alignment);
        }

        return Math.ceil(currentOffset / maxAlignment) * maxAlignment;
    }

    private getFieldByteSize(field: GirField, namespace: string): number {
        const type = field.type;
        if (type.cType?.includes("*")) return 8;
        if (this.isCallbackType(type.name as string, namespace)) return 8;

        if (type.isArray && type.fixedSize !== undefined && type.elementType) {
            const elemSize = this.getTypePrimitiveSize(type.elementType.name as string, namespace);
            return elemSize * type.fixedSize;
        }

        return this.getTypePrimitiveSize(type.name as string, namespace);
    }

    private getFieldAlignment(field: GirField, namespace: string): number {
        const type = field.type;
        if (type.cType?.includes("*")) return 8;
        if (this.isCallbackType(type.name as string, namespace)) return 8;

        if (type.isArray && type.fixedSize !== undefined && type.elementType) {
            return this.getTypeAlignment(type.elementType.name as string, namespace);
        }

        return this.getTypeAlignment(type.name as string, namespace);
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
            const size = this.computeStructSize(record.fields, parts.namespace);
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
            const primitive = PRIMITIVE_TYPE_MAP.get(type.name as string);
            if (primitive) {
                return getFfiTypeByteSize(primitive.ffi.type);
            }
        }
        return 8;
    }
}

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
