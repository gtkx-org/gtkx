/**
 * FFI Type Mapper
 *
 * Maps normalized GIR types to TypeScript and FFI representations.
 * Works with the new GirRepository API and returns imports directly
 * instead of using callbacks.
 */

import type {
    GirRepository,
    NormalizedCallback,
    NormalizedNamespace,
    NormalizedParameter,
    NormalizedType,
    QualifiedName,
} from "@gtkx/gir";
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
    gobjectType,
    type MappedType,
    PRIMITIVE_TYPE_MAP,
    refType,
    stringType,
    structType,
    type TypeImport,
    type TypeKind,
} from "./ffi-types.js";

/**
 * Maps normalized GIR types to TypeScript and FFI representations.
 *
 * Key differences from legacy TypeMapper:
 * - Works with NormalizedType instead of GirType
 * - Uses GirRepository for type resolution instead of TypeRegistry
 * - Returns imports in the result instead of using callbacks
 * - No registration methods (repository already has all types)
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
     * @returns Mapped type with TypeScript string, FFI descriptor, and required imports
     */
    mapType(type: NormalizedType, isReturn = false, parentTransferOwnership?: string): MappedType {
        const imports: TypeImport[] = [];

        if (type.isArray) {
            const listType = type.cType?.includes("GSList")
                ? "gslist"
                : type.cType?.includes("GList")
                  ? "glist"
                  : undefined;

            if (type.elementType) {
                const elementTransferOwnership = type.transferOwnership ?? parentTransferOwnership;
                const elementResult = this.mapType(type.elementType, isReturn, elementTransferOwnership);
                imports.push(...elementResult.imports);

                return {
                    ts: `${elementResult.ts}[]`,
                    ffi: arrayType(elementResult.ffi, listType, !isReturn),
                    imports,
                };
            }

            return {
                ts: "unknown[]",
                ffi: arrayType(FFI_VOID, listType, !isReturn),
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
            return this.mapResolvedType(resolved, isReturn, imports);
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
    mapParameter(param: NormalizedParameter): MappedType {
        const imports: TypeImport[] = [];

        if (param.direction === "out" || param.direction === "inout") {
            const innerType = this.mapType(param.type);
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
    isClosureTarget(param: NormalizedParameter, allParams: readonly NormalizedParameter[]): boolean {
        const paramIndex = allParams.indexOf(param);
        return allParams.some((p) => {
            const qualifiedName = this.qualifyTypeName(p.type.name);
            return isSupportedCallback(qualifiedName) && (p.closure === paramIndex || p.destroy === paramIndex);
        });
    }

    /**
     * Checks if a parameter is nullable.
     */
    isNullable(param: NormalizedParameter): boolean {
        return param.nullable || param.optional;
    }

    /**
     * Checks if a parameter has an unsupported callback type.
     * Supported callbacks are those with trampolines in CALLBACK_TRAMPOLINES.
     */
    hasUnsupportedCallback(param: NormalizedParameter): boolean {
        const qualifiedName = this.qualifyTypeName(param.type.name);
        if (isSupportedCallback(qualifiedName)) {
            return false;
        }

        return param.type.name === "GLib.Closure" || this.isCallback(param.type.name);
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

    /**
     * Qualifies a type name with the current namespace if not already qualified.
     */
    private qualifyTypeName(typeName: string): string {
        if (typeName.includes(".")) {
            return typeName;
        }
        return `${this.currentNamespace}.${typeName}`;
    }

    /**
     * Core type resolution from a namespace.
     * Extracted to eliminate duplication between resolveType and resolveQualifiedType.
     */
    private resolveFromNamespace(
        ns: NormalizedNamespace,
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

    private mapResolvedType(resolved: ResolvedType, isReturn: boolean, imports: TypeImport[]): MappedType {
        const qualifiedName = resolved.isExternal
            ? `${resolved.namespace}.${resolved.transformedName}`
            : resolved.transformedName;

        if ((resolved.kind === "class" || resolved.kind === "interface") && this.skippedClasses.has(resolved.name)) {
            return {
                ts: "unknown",
                ffi: gobjectType(!isReturn),
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
                if (resolved.name === "Variant" && resolved.namespace === "GLib") {
                    return {
                        ts: qualifiedName,
                        ffi: { type: "gvariant", ownership: isReturn ? "none" : "full" },
                        imports,
                        kind: "record",
                    };
                }

                const { glibTypeName, glibGetType } = resolved;
                if (!glibTypeName || !glibGetType) {
                    return {
                        ts: qualifiedName,
                        ffi: structType(resolved.transformedName, !isReturn),
                        imports,
                        kind: "record",
                    };
                }

                const sharedLib = this.repo.getNamespace(resolved.namespace)?.sharedLibrary;
                return {
                    ts: qualifiedName,
                    ffi: boxedType(glibTypeName, !isReturn, sharedLib, glibGetType),
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
                if (resolved.glibTypeName === "GParam") {
                    return {
                        ts: qualifiedName,
                        ffi: { type: "gparam", ownership: isReturn ? "none" : "full" },
                        imports,
                        kind: resolved.kind,
                    };
                }

                return {
                    ts: qualifiedName,
                    ffi: gobjectType(!isReturn),
                    imports,
                    kind: resolved.kind,
                };
            }
        }
    }

    /**
     * Maps a callback type using GIR metadata.
     * The trampoline name comes from the registry, but the TypeScript signature
     * and FFI descriptors are derived from the callback's GIR definition.
     */
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

    /**
     * Builds TypeScript parameter strings for a callback.
     * Filters out user_data/data parameters (handled by trampoline).
     */
    private buildCallbackTsParams(callback: NormalizedCallback, imports: TypeImport[]): string[] {
        const result: string[] = [];

        for (const param of callback.parameters) {
            if (param.name === "user_data" || param.name === "data") continue;

            const mapped = this.mapType(param.type);
            imports.push(...mapped.imports);

            const nullable = param.nullable ? " | null" : "";
            result.push(`${param.name}: ${mapped.ts}${nullable}`);
        }

        return result;
    }

    /**
     * Builds TypeScript return type for a callback.
     */
    private buildCallbackTsReturn(returnType: NormalizedType): string {
        if (returnType.name === "none" || returnType.name === "void") {
            return "void";
        }
        const mapped = this.mapType(returnType, true);
        const nullable = returnType.nullable ? " | null" : "";
        return `${mapped.ts}${nullable}`;
    }

    /**
     * Builds FFI descriptor for a callback.
     */
    private buildCallbackFfiDescriptor(
        callback: NormalizedCallback,
        trampoline: TrampolineName,
    ): {
        type: "callback";
        trampoline: TrampolineName;
        argTypes?: FfiTypeDescriptor[];
        returnType?: FfiTypeDescriptor;
    } {
        const argTypes = callback.parameters
            .filter((p) => p.name !== "user_data" && p.name !== "data")
            .map((p) => this.mapType(p.type).ffi);

        const hasReturn = callback.returnType.name !== "none" && callback.returnType.name !== "void";
        const returnType = hasReturn ? this.mapType(callback.returnType, true).ffi : undefined;

        return {
            type: "callback",
            trampoline,
            argTypes: argTypes.length > 0 ? argTypes : undefined,
            returnType,
        };
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
    sharedLibrary?: string;
};
