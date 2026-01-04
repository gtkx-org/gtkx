/**
 * FFI Type Mapper
 *
 * Maps normalized GIR types to TypeScript and FFI representations.
 * Works with the new GirRepository API and returns imports directly
 * instead of using callbacks.
 */

import type { GirCallback, GirNamespace, GirParameter, GirRepository, GirType, QualifiedName } from "@gtkx/gir";
import { isIntrinsicType, isStringType, parseQualifiedName } from "@gtkx/gir";
import { getTrampolineName, isSupportedCallback, type TrampolineName } from "../constants/index.js";
import { normalizeClassName, toPascalCase } from "../utils/naming.js";
import {
    arrayType,
    boxedType,
    FFI_INT32,
    FFI_POINTER,
    FFI_UINT32,
    FFI_VOID,
    type FfiTypeDescriptor,
    fundamentalType,
    gArrayType,
    gobjectType,
    hashTableType,
    type MappedType,
    PRIMITIVE_TYPE_MAP,
    ptrArrayType,
    refType,
    stringType,
    structType,
    type TypeImport,
    type TypeKind,
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
 * // result.ffi = { type: "gobject", ownership: "none" }
 * // result.imports = [{ kind: "class", name: "Button", ... }]
 * ```
 */
export class FfiMapper {
    private skippedClasses = new Set<string>();

    constructor(
        private repo: GirRepository,
        private currentNamespace: string,
    ) {}

    /**
     * Maps a normalized type to TypeScript and FFI representations.
     *
     * @param type - The normalized type to map
     * @param isReturn - Whether this is a return type (affects ownership)
     * @param parentTransferOwnership - Transfer ownership from parent context
     * @param lengthParamOffset - Offset to add to lengthParamIndex for sized arrays (e.g., 1 for instance methods)
     * @returns Mapped type with TypeScript string, FFI descriptor, and required imports
     */
    mapType(type: GirType, isReturn = false, parentTransferOwnership?: string, lengthParamOffset = 0): MappedType {
        const imports: TypeImport[] = [];

        if (type.isHashTable()) {
            const keyType = type.getKeyType();
            const valueType = type.getValueType();
            const transferFull = this.computeTransferFull(isReturn, type.transferOwnership ?? parentTransferOwnership);

            if (keyType && valueType) {
                const keyResult = this.mapType(keyType, isReturn, parentTransferOwnership);
                const valueResult = this.mapType(valueType, isReturn, parentTransferOwnership);
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

        if (type.isPtrArray() || type.isGArray()) {
            return this.mapGLibArrayContainer(type, isReturn, parentTransferOwnership, imports);
        }

        if (type.isArray) {
            const transferFull = this.computeTransferFull(isReturn, type.transferOwnership ?? parentTransferOwnership);

            const isSizedArray =
                type.lengthParamIndex !== undefined &&
                (type.zeroTerminated === false || type.zeroTerminated === undefined);

            const isFixedSizeArray = type.fixedSize !== undefined;

            let listType: "glist" | "gslist" | "sized" | "fixed" | undefined = type.isList()
                ? (type.containerType as "glist" | "gslist")
                : type.cType?.includes("GSList")
                  ? "gslist"
                  : type.cType?.includes("GList")
                    ? "glist"
                    : undefined;

            if (isFixedSizeArray) {
                listType = "fixed";
            } else if (isSizedArray) {
                listType = "sized";
            }

            const adjustedLengthParamIndex =
                type.lengthParamIndex !== undefined ? type.lengthParamIndex + lengthParamOffset : undefined;

            if (type.elementType) {
                const elementTransferOwnership = type.transferOwnership ?? parentTransferOwnership;
                const elementResult = this.mapType(
                    type.elementType,
                    isReturn,
                    elementTransferOwnership,
                    lengthParamOffset,
                );
                imports.push(...elementResult.imports);

                return {
                    ts: `${elementResult.ts}[]`,
                    ffi: arrayType(elementResult.ffi, listType, transferFull, adjustedLengthParamIndex, type.fixedSize),
                    imports,
                };
            }

            return {
                ts: "unknown[]",
                ffi: arrayType(FFI_VOID, listType, transferFull, adjustedLengthParamIndex, type.fixedSize),
                imports,
            };
        }

        if (isStringType(type.name)) {
            const effectiveTransferOwnership = type.transferOwnership ?? parentTransferOwnership;
            const transferFull = effectiveTransferOwnership !== "none";
            return {
                ts: "string",
                ffi: stringType(transferFull),
                imports,
            };
        }

        const primitive = PRIMITIVE_TYPE_MAP.get(type.name);
        if (primitive) {
            return { ...primitive, imports };
        }

        const typeName = type.name;
        const resolved = this.resolveType(typeName);
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
     */
    mapParameter(param: GirParameter): MappedType {
        const imports: TypeImport[] = [];

        if (param.direction === "out" || param.direction === "inout") {
            const innerType = this.mapType(param.type, false, param.transferOwnership);
            imports.push(...innerType.imports);

            const isBoxedOrGObjectOrStruct =
                innerType.ffi.type === "boxed" || innerType.ffi.type === "gobject" || innerType.ffi.type === "struct";

            if (param.callerAllocates && isBoxedOrGObjectOrStruct) {
                return {
                    ts: innerType.ts,
                    ffi: { ...innerType.ffi, ownership: "none" as const },
                    imports,
                    kind: innerType.kind,
                };
            }

            return {
                ts: `Ref<${innerType.ts}>`,
                ffi: refType(innerType.ffi),
                imports,
                kind: innerType.kind,
                innerTsType: innerType.ts,
            };
        }

        const qualifiedCallbackName = this.qualifyTypeName(param.type.name);
        const callbackResult = this.mapCallback(qualifiedCallbackName, imports);
        if (callbackResult) {
            return callbackResult;
        }

        if (param.type.name === "GLib.Closure" || this.isCallback(param.type.name)) {
            return {
                ts: "(...args: unknown[]) => unknown",
                ffi: { type: "callback" },
                imports,
            };
        }

        const mapped = this.mapType(param.type, false, param.transferOwnership);
        const isObjectType = mapped.ffi.type === "gobject" || mapped.ffi.type === "boxed";
        const isTransferFull = param.transferOwnership === "full";
        const isTransferNone = param.transferOwnership === "none" || param.transferOwnership === undefined;

        if (isObjectType && isTransferFull) {
            return {
                ts: mapped.ts,
                ffi: { ...mapped.ffi, ownership: "full" as const },
                imports: mapped.imports,
                kind: mapped.kind,
            };
        }

        if (isObjectType && isTransferNone) {
            return {
                ts: mapped.ts,
                ffi: { ...mapped.ffi, ownership: "none" as const },
                imports: mapped.imports,
                kind: mapped.kind,
            };
        }

        return mapped;
    }

    /**
     * Checks if a parameter is a closure target (user_data or destroy notify).
     * Closure targets are associated with supported callback parameters.
     */
    isClosureTarget(param: GirParameter, allParams: readonly GirParameter[]): boolean {
        const paramIndex = allParams.indexOf(param);
        return allParams.some((p) => {
            const qualifiedName = this.qualifyTypeName(p.type.name);
            return isSupportedCallback(qualifiedName) && (p.closure === paramIndex || p.destroy === paramIndex);
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
     * Supported callbacks are those with trampolines in CALLBACK_TRAMPOLINES.
     */
    hasUnsupportedCallback(param: GirParameter): boolean {
        const qualifiedName = this.qualifyTypeName(param.type.name);
        if (isSupportedCallback(qualifiedName)) {
            return false;
        }

        return param.type.name === "GLib.Closure" || this.isCallback(param.type.name);
    }

    getCallbackParamMappings(param: GirParameter): Array<{ name: string; mapped: MappedType }> | null {
        const qualifiedName = this.qualifyTypeName(param.type.name);
        if (!isSupportedCallback(qualifiedName)) {
            return null;
        }

        const callback = this.repo.resolveCallback(qualifiedName as QualifiedName);
        if (!callback) {
            return null;
        }

        return callback.parameters
            .filter((p) => p.name !== "user_data" && p.name !== "data")
            .map((p) => ({
                name: p.name,
                mapped: this.mapType(p.type, false, p.transferOwnership),
            }));
    }

    getCallbackReturnType(param: GirParameter): MappedType | null {
        const qualifiedName = this.qualifyTypeName(param.type.name);
        if (!isSupportedCallback(qualifiedName)) {
            return null;
        }

        const callback = this.repo.resolveCallback(qualifiedName as QualifiedName);
        if (!callback) {
            return null;
        }

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
     * Checks if a type is a callback.
     */
    isCallback(typeName: string): boolean {
        if (typeName.includes(".")) {
            const { namespace, name } = parseQualifiedName(typeName as QualifiedName);
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
                transformedName: normalizeClassName(name, namespace),
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
                transformedName: normalizeClassName(name, namespace),
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
                transformedName: normalizeClassName(name, namespace),
                isExternal,
                glibTypeName: record.glibTypeName,
                glibGetType: record.glibGetType,
                isPlainStruct: record.isPlainStruct(),
                isFundamental: record.isFundamental(),
                copyFunction: record.copyFunction,
                freeFunction: record.freeFunction,
            };
        }

        if (ns.enumerations.has(name)) {
            return {
                kind: "enum",
                name,
                namespace,
                transformedName: toPascalCase(name),
                isExternal,
            };
        }

        if (ns.bitfields.has(name)) {
            return {
                kind: "flags",
                name,
                namespace,
                transformedName: toPascalCase(name),
                isExternal,
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

        return null;
    }

    private resolveType(typeName: string): ResolvedType | null {
        if (isIntrinsicType(typeName)) {
            return null;
        }

        if (typeName.includes(".")) {
            return this.resolveQualifiedType(typeName as QualifiedName);
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

    private resolveQualifiedType(qualifiedName: QualifiedName): ResolvedType | null {
        const { namespace, name } = parseQualifiedName(qualifiedName);
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
                return {
                    ts: qualifiedName,
                    ffi: FFI_INT32,
                    imports,
                    kind: "enum",
                };

            case "flags":
                return {
                    ts: qualifiedName,
                    ffi: FFI_UINT32,
                    imports,
                    kind: "flags",
                };

            case "record": {
                const transferFull = this.computeTransferFull(isReturn, transferOwnership);

                if (resolved.isFundamental && resolved.copyFunction && resolved.freeFunction) {
                    const sharedLib = this.repo.getNamespace(resolved.namespace)?.sharedLibrary;
                    if (sharedLib) {
                        return {
                            ts: qualifiedName,
                            ffi: fundamentalType(sharedLib, resolved.copyFunction, resolved.freeFunction, transferFull),
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

            case "callback":
                return {
                    ts: "number",
                    ffi: FFI_POINTER,
                    imports,
                    kind: "callback",
                };

            case "class":
            case "interface": {
                const transferFull = this.computeTransferFull(isReturn, transferOwnership);

                if (resolved.isFundamental && resolved.refFunc && resolved.unrefFunc) {
                    const sharedLib = this.repo.getNamespace(resolved.namespace)?.sharedLibrary;
                    if (sharedLib) {
                        return {
                            ts: qualifiedName,
                            ffi: fundamentalType(sharedLib, resolved.refFunc, resolved.unrefFunc, transferFull),
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
        }
    }

    private mapCallback(qualifiedName: string, imports: TypeImport[]): MappedType | null {
        const trampoline = getTrampolineName(qualifiedName);
        if (!trampoline) {
            return null;
        }

        const callback = this.repo.resolveCallback(qualifiedName as QualifiedName);
        if (!callback) {
            return null;
        }

        const tsParams = this.buildCallbackTsParams(callback, imports);
        const tsReturn = this.buildCallbackTsReturn(callback.returnType);
        const ts = `(${tsParams.join(", ")}) => ${tsReturn}`;
        const ffi = this.buildCallbackFfiDescriptor(callback, trampoline);

        return { ts, ffi, imports };
    }

    private buildCallbackTsParams(callback: GirCallback, imports: TypeImport[]): string[] {
        const result: string[] = [];

        for (const param of callback.parameters) {
            if (param.name === "user_data" || param.name === "data") continue;

            const mapped = this.mapType(param.type, false, param.transferOwnership);
            imports.push(...mapped.imports);

            const nullable = param.nullable ? " | null" : "";
            result.push(`${param.name}: ${mapped.ts}${nullable}`);
        }

        return result;
    }

    private buildCallbackTsReturn(returnType: GirType): string {
        if (returnType.name === "none" || returnType.name === "void") {
            return "void";
        }
        const mapped = this.mapType(returnType, true, returnType.transferOwnership);
        const nullable = returnType.nullable ? " | null" : "";
        return `${mapped.ts}${nullable}`;
    }

    private buildCallbackFfiDescriptor(
        callback: GirCallback,
        trampoline: TrampolineName,
    ): {
        type: "callback";
        trampoline: TrampolineName;
        argTypes?: FfiTypeDescriptor[];
        returnType?: FfiTypeDescriptor;
    } {
        const argTypes = callback.parameters
            .filter((p) => p.name !== "user_data" && p.name !== "data")
            .map((p) => this.mapType(p.type, false, p.transferOwnership).ffi);

        const hasReturn = callback.returnType.name !== "none" && callback.returnType.name !== "void";
        const returnType = hasReturn
            ? this.mapType(callback.returnType, true, callback.returnType.transferOwnership).ffi
            : undefined;

        return {
            type: "callback",
            trampoline,
            argTypes: argTypes.length > 0 ? argTypes : undefined,
            returnType,
        };
    }

    private mapGLibArrayContainer(
        type: GirType,
        isReturn: boolean,
        parentTransferOwnership: string | undefined,
        imports: TypeImport[],
    ): MappedType {
        const isGArray = type.isGArray();
        const transferFull = this.computeTransferFull(isReturn, type.transferOwnership ?? parentTransferOwnership);

        if (type.elementType) {
            const elementTransferOwnership = type.transferOwnership ?? parentTransferOwnership;
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

    private getElementSize(type: GirType): number {
        if (type.isNumeric()) {
            const primitive = PRIMITIVE_TYPE_MAP.get(type.name as string);
            if (primitive?.ffi.size) {
                return primitive.ffi.size / 8;
            }
        }
        return 8;
    }
}

/**
 * Internal type for resolved type information.
 */
type ResolvedType = {
    kind: TypeKind;
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
};
