/**
 * Property Accessor Builder
 *
 * Generates GObject property bindings shaped as ES6 `get`/`set` accessor
 * pairs in the class or interface body.
 *
 * For properties with explicit GIR getter/setter methods, the accessor
 * delegates to those methods. For properties without, the accessor
 * contains inline GValue logic via g_object_get_property /
 * g_object_set_property. Construct-only properties get a getter-only
 * accessor (no setter).
 */

import { accessor } from "../../../builders/index.js";
import type { AccessorBuilder } from "../../../builders/members/accessor.js";
import type { Writer } from "../../../builders/text-writer.js";
import { addTypeImports, type ImportCollector } from "../../../ffi-emitters/index.js";
import type { FfiGeneratorOptions } from "../../../generator-types.js";
import type { GirClass, GirMethod, GirProperty, GirRepository } from "../../../gir/index.js";
import type { FfiMapper } from "../../../type-system/ffi-mapper.js";
import {
    getSyntheticGetterPrimitiveInfo,
    getSyntheticSetterPrimitiveInfo,
    type MappedType,
} from "../../../type-system/ffi-types.js";
import {
    collectDirectMembers,
    collectParentMethodNames,
    collectParentPropertyNames,
    collectReachableVirtualMethodNames,
} from "../../../utils/class-traversal.js";
import { buildJsDocStructure } from "../../../utils/doc-formatter.js";
import { toCamelCase } from "../../../utils/naming.js";

/**
 * A single property binding expressed as an ES6 `get`/`set` accessor pair
 * to add to a class or interface body.
 */
export type PropertyAccessorEmission = {
    /**
     * ES6 get/set accessor carrying the property's runtime get/set
     * behavior, suitable for adding directly to a class or interface body.
     */
    readonly accessor: AccessorBuilder;
};

/**
 * Source for an interface property-accessor pass: the resolved interface name
 * and the flattened property list (the interface's own properties plus those
 * inherited from prerequisite classes and interfaces).
 */
export type InterfacePropertySource = {
    /** Interface name owning the emitted accessors. */
    readonly ownerName: string;
    /** Properties to install, deduplicated and flattened across prerequisites. */
    readonly properties: readonly GirProperty[];
    /**
     * Getter/setter methods reachable on the interface, keyed by C identifier.
     * A property accessor delegates to one of these when its value type cannot
     * be marshaled through the generic `g_object_get_property` path.
     */
    readonly methodsByCIdentifier: ReadonlyMap<string, GirMethod>;
    /**
     * camelCased `<virtual-method>` names reachable on the interface. A property
     * whose name collides with one of these is suppressed, mirroring how
     * ts-for-gir resolves the same-name property/virtual-method conflict.
     */
    readonly virtualMethodNames: ReadonlySet<string>;
};

/**
 * Options for {@link PropertyAccessorBuilder}.
 */
export type PropertyAccessorBuilderOptions = {
    cls: GirClass | null;
    ffiMapper: FfiMapper;
    imports: ImportCollector;
    repository: GirRepository;
    options: FfiGeneratorOptions;
    selfNames?: ReadonlySet<string>;
    interfaceSource?: InterfacePropertySource | null;
};

export class PropertyAccessorBuilder {
    private readonly parentMethodNames: ReadonlySet<string>;
    private readonly conflictingVirtualMethodNames: ReadonlySet<string>;
    private readonly cls: GirClass | null;
    private readonly ffiMapper: FfiMapper;
    private readonly imports: ImportCollector;
    private readonly repository: GirRepository;
    private readonly options: FfiGeneratorOptions;
    private readonly selfNames: ReadonlySet<string>;
    private readonly interfaceSource: InterfacePropertySource | null;

    constructor(opts: PropertyAccessorBuilderOptions) {
        const { cls, ffiMapper, imports, repository, options, selfNames = new Set(), interfaceSource = null } = opts;
        this.cls = cls;
        this.ffiMapper = ffiMapper;
        this.imports = imports;
        this.repository = repository;
        this.options = options;
        this.selfNames = selfNames;
        this.interfaceSource = interfaceSource;
        this.parentMethodNames = cls === null ? new Set() : collectParentMethodNames(cls, repository);
        this.conflictingVirtualMethodNames =
            cls === null
                ? (interfaceSource?.virtualMethodNames ?? new Set())
                : collectReachableVirtualMethodNames(cls, repository);
    }

    buildAccessors(): PropertyAccessorEmission[] {
        const directProps =
            this.cls === null
                ? (this.interfaceSource?.properties ?? [])
                : collectDirectMembers({
                      cls: this.cls,
                      repo: this.repository,
                      getClassMembers: (c) => c.properties,
                      getInterfaceMembers: (i) => i.properties,
                      getParentNames: collectParentPropertyNames,
                      transformName: toCamelCase,
                      isHidden: () => false,
                  });

        return directProps
            .map((prop) => this.buildAccessor(prop))
            .filter((a): a is PropertyAccessorEmission => a !== null);
    }

    private buildAccessor(prop: GirProperty): PropertyAccessorEmission | null {
        const camelName = toCamelCase(prop.name);

        if (this.conflictingVirtualMethodNames.has(camelName)) {
            return null;
        }

        const typeMapping = this.ffiMapper.mapType(prop.type, false, prop.type.transferOwnership);

        if (typeMapping.unsafe) {
            return this.buildGenericAccessor(prop, camelName);
        }

        const getBody = this.buildGetBody(prop, typeMapping);
        if (!getBody) {
            if (!prop.readable) return null;
            return this.buildGenericAccessor(prop, camelName);
        }

        const returnType = this.computeGetterReturnType(prop, typeMapping);

        addTypeImports(this.imports, typeMapping.imports, this.selfNames);

        let setBody: ((writer: Writer) => void) | undefined;
        let setType: string | undefined;
        if (prop.writable && !prop.constructOnly) {
            setBody = this.buildSetBody(prop, typeMapping);
            if (setBody) {
                setType = this.resolveSetterType(prop, typeMapping);
            }
        }

        const docs = buildJsDocStructure(prop.doc, this.options.namespace);

        const resolvedSetType = setType && setType !== returnType ? setType : returnType;
        const accessorMember = accessor(camelName, {
            type: returnType,
            setType: resolvedSetType,
            getBody,
            setBody,
            doc: docs?.[0]?.description,
        });

        return { accessor: accessorMember };
    }

    /**
     * Builds a read-only accessor for a property whose value type the runtime
     * marshaling layer cannot statically map.
     *
     * The getter delegates to the generic `getProperty` GValue path, which
     * resolves any GObject property at run time. The accessor type is
     * `unknown`, which satisfies the concrete type the `.d.ts` contract
     * declares for the property.
     */
    private buildGenericAccessor(prop: GirProperty, camelName: string): PropertyAccessorEmission {
        const docs = buildJsDocStructure(prop.doc, this.options.namespace);
        const getBody = (writer: Writer): void => {
            writer.writeLine(`return this.getProperty(${JSON.stringify(prop.name)});`);
        };
        const accessorMember = accessor(camelName, {
            type: "unknown",
            getBody,
            doc: docs?.[0]?.description,
        });
        return { accessor: accessorMember };
    }

    private buildGetBody(prop: GirProperty, typeMapping: MappedType): ((writer: Writer) => void) | null {
        if (!prop.readable) return null;

        const delegate = this.resolveDelegateGetter(prop, typeMapping);
        if (delegate) {
            const { methodName } = delegate;
            return (writer) => {
                writer.writeLine(`return this.${methodName}();`);
            };
        }

        return this.buildSyntheticGetBody(prop, typeMapping);
    }

    private buildSetBody(prop: GirProperty, typeMapping: MappedType): ((writer: Writer) => void) | undefined {
        const delegate = this.resolveDelegateSetter(prop);
        if (delegate) {
            const { methodName } = delegate;
            return (writer) => {
                writer.writeLine(`this.${methodName}(value);`);
            };
        }

        return this.buildSyntheticSetBody(prop, typeMapping);
    }

    private resolveOwnMethod(accessorId: string): GirMethod | null {
        if (this.cls === null) {
            return this.interfaceSource?.methodsByCIdentifier.get(accessorId) ?? null;
        }
        return this.cls.getMethodByCIdentifier(accessorId) ?? this.cls.getMethod(accessorId) ?? null;
    }

    private resolveNonConflictingMethodName(accessorId: string): { methodName: string; method: GirMethod } | null {
        const method = this.resolveOwnMethod(accessorId);
        if (!method) return null;
        if (this.parentMethodNames.has(method.name)) return null;
        return { methodName: toCamelCase(method.name), method };
    }

    private resolveDelegateGetter(
        prop: GirProperty,
        typeMapping: MappedType,
    ): { methodName: string; method: GirMethod } | null {
        if (!prop.getter) return null;
        const resolved = this.resolveNonConflictingMethodName(prop.getter);
        if (!resolved) return null;
        if (resolved.methodName === toCamelCase(prop.name)) return null;
        const { method } = resolved;
        const returnMapping = this.ffiMapper.mapType(method.returnType, false, method.returnType.transferOwnership);
        if (returnMapping.unsafe) return null;
        if (returnMapping.ts === "void" || method.parameters.length > 0) return null;
        if (returnMapping.ts !== typeMapping.ts) return null;
        return resolved;
    }

    private resolveDelegateSetter(prop: GirProperty): { methodName: string; method: GirMethod } | null {
        if (!prop.setter) return null;
        const resolved = this.resolveNonConflictingMethodName(prop.setter);
        if (!resolved) return null;
        if (resolved.methodName === toCamelCase(prop.name)) return null;
        if (resolved.method.parameters.length !== 1) return null;
        const setterParam = resolved.method.parameters[0];
        if (!setterParam) return null;
        if (this.ffiMapper.mapParameter(setterParam).unsafe) return null;
        return resolved;
    }

    private computeGetterReturnType(prop: GirProperty, typeMapping: MappedType): string {
        let returnType = typeMapping.ts;
        let alreadyNullable = false;

        const delegate = this.resolveDelegateGetter(prop, typeMapping);
        if (delegate) {
            if (delegate.method.returnType.nullable) {
                returnType = `${returnType} | null`;
                alreadyNullable = true;
            }
        } else {
            const getterInfo = this.getGValueGetterInfo(prop, typeMapping);
            if (
                getterInfo &&
                (getterInfo.isInterface || getterInfo.isBoxed || getterInfo.isFundamental) &&
                !(typeMapping.nullable ?? false)
            ) {
                returnType = `${returnType} | null`;
                alreadyNullable = true;
            }
        }

        if (!alreadyNullable && prop.defaultValue?.kind === "null") {
            returnType = `${returnType} | null`;
        }

        return returnType;
    }

    private resolveSetterType(prop: GirProperty, typeMapping: MappedType): string {
        let result: string;
        let alreadyNullable = false;
        const delegate = this.resolveDelegateSetter(prop);
        if (delegate) {
            const paramType = delegate.method.parameters[0];
            if (paramType) {
                const paramMapping = this.ffiMapper.mapType(paramType.type, false, paramType.type.transferOwnership);
                addTypeImports(this.imports, paramMapping.imports, this.selfNames);
                result = paramMapping.ts;
                if (paramType.nullable) {
                    result = `${result} | null`;
                    alreadyNullable = true;
                }
            } else {
                result = typeMapping.ts;
            }
        } else {
            result = typeMapping.ts;
        }

        if (!alreadyNullable && prop.defaultValue?.kind === "null") {
            result = `${result} | null`;
        }
        return result;
    }

    private buildSyntheticGetBody(prop: GirProperty, typeMapping: MappedType): ((writer: Writer) => void) | null {
        if (!this.getGValueGetterInfo(prop, typeMapping)) return null;
        return (writer) => {
            writer.writeLine(`return this.getProperty("${prop.name}");`);
        };
    }

    private buildSyntheticSetBody(prop: GirProperty, typeMapping: MappedType): ((writer: Writer) => void) | undefined {
        if (!this.getGValueSetterInfo(prop, typeMapping)) return undefined;
        return (writer) => {
            writer.writeLine(`this.setProperty("${prop.name}", value);`);
        };
    }

    private getGValueGetterInfo(prop: GirProperty, typeMapping: MappedType): GValueGetterInfo | null {
        const typeName = String(prop.type.name);
        const primitiveInfo = getSyntheticGetterPrimitiveInfo(typeName);
        if (primitiveInfo) return primitiveInfo;

        if (typeMapping.kind === "enum") {
            return { gtypeName: "gint", getMethod: "getInt", isEnum: true };
        }
        if (typeMapping.kind === "flags") {
            return { gtypeName: "guint", getMethod: "getUint", isFlags: true };
        }
        if (typeMapping.kind === "class") {
            const fundamentalInfo = this.getFundamentalClassGetterInfo(typeName, typeMapping);
            if (fundamentalInfo) return fundamentalInfo;
            return { getMethod: "getObject", isClass: true };
        }
        if (typeMapping.kind === "interface") {
            return { getMethod: "getObject", isInterface: true };
        }
        if (typeMapping.kind === "record") {
            return this.getRecordGetterInfo(typeName, typeMapping);
        }
        return null;
    }

    private getFundamentalClassGetterInfo(typeName: string, typeMapping: MappedType): GValueGetterInfo | null {
        const qualifiedName = typeName.includes(".") ? typeName : `${this.options.namespace}.${typeName}`;
        const cls = this.repository.resolveClass(qualifiedName);
        if (!cls?.fundamental) return null;

        if (cls.refFunc === "g_variant_ref_sink") {
            return { gtypeName: "GVariant", getMethod: "getVariant", isFundamental: true };
        }
        if (cls.refFunc === "g_param_spec_ref_sink") {
            return { gtypeName: "GParam", getMethod: "getParam", isFundamental: true };
        }
        if (cls.glibTypeName) {
            return { gtypeName: cls.glibTypeName, getMethod: "getBoxed", isBoxed: true, tsType: typeMapping.ts };
        }
        return null;
    }

    private getRecordGetterInfo(typeName: string, typeMapping: MappedType): GValueGetterInfo | null {
        if (typeMapping.ffi.type === "boxed" && typeof typeMapping.ffi.innerType === "string") {
            return {
                gtypeName: typeMapping.ffi.innerType,
                getMethod: "getBoxed",
                isBoxed: true,
                tsType: typeMapping.ts,
            };
        }
        if (typeMapping.ffi.type === "fundamental") {
            const qualifiedName = typeName.includes(".") ? typeName : `${this.options.namespace}.${typeName}`;
            const record = this.repository.resolveRecord(qualifiedName);
            if (record?.glibTypeName) {
                return {
                    gtypeName: record.glibTypeName,
                    getMethod: "getBoxed",
                    isBoxed: true,
                    tsType: typeMapping.ts,
                };
            }
        }
        return null;
    }

    private getGValueSetterInfo(prop: GirProperty, typeMapping: MappedType): GValueSetterInfo | null {
        const typeName = String(prop.type.name);
        const primitiveInfo = getSyntheticSetterPrimitiveInfo(typeName);
        if (primitiveInfo) return primitiveInfo;

        if (typeMapping.kind === "enum") {
            return { gtypeName: "gint", setMethod: "setInt", isEnum: true };
        }
        if (typeMapping.kind === "flags") {
            return { gtypeName: "guint", setMethod: "setUint", isFlags: true };
        }
        if (typeMapping.kind === "class") {
            const fundamentalInfo = this.getFundamentalClassSetterInfo(typeName);
            if (fundamentalInfo) return fundamentalInfo;
            return { staticConstructor: "newFromObject", isClass: true };
        }
        if (typeMapping.kind === "interface") {
            return { staticConstructor: "newFromObject", isInterface: true };
        }
        if (typeMapping.kind === "record") {
            return this.getRecordSetterInfo(typeName, typeMapping);
        }
        return null;
    }

    private getFundamentalClassSetterInfo(typeName: string): GValueSetterInfo | null {
        const qualifiedName = typeName.includes(".") ? typeName : `${this.options.namespace}.${typeName}`;
        const cls = this.repository.resolveClass(qualifiedName);
        if (!cls?.fundamental) return null;

        if (cls.refFunc === "g_variant_ref_sink") {
            return { staticConstructor: "newFromVariant" };
        }
        if (cls.refFunc === "g_param_spec_ref_sink") {
            return { gtypeName: "GParam", setMethod: "setParam", isFundamental: true };
        }
        if (cls.glibTypeName) {
            return { staticConstructor: "newFromBoxed", gtypeName: cls.glibTypeName };
        }
        return null;
    }

    private getRecordSetterInfo(typeName: string, typeMapping: MappedType): GValueSetterInfo | null {
        if (typeMapping.ffi.type === "boxed" && typeof typeMapping.ffi.innerType === "string") {
            return { staticConstructor: "newFromBoxed", gtypeName: typeMapping.ffi.innerType };
        }
        if (typeMapping.ffi.type === "fundamental") {
            const qualifiedName = typeName.includes(".") ? typeName : `${this.options.namespace}.${typeName}`;
            const record = this.repository.resolveRecord(qualifiedName);
            if (record?.glibTypeName) {
                return { staticConstructor: "newFromBoxed", gtypeName: record.glibTypeName };
            }
        }
        return null;
    }
}

interface GValueGetterInfo {
    gtypeName?: string;
    getMethod: string;
    isString?: boolean;
    isEnum?: boolean;
    isFlags?: boolean;
    isClass?: boolean;
    isInterface?: boolean;
    isBoxed?: boolean;
    isFundamental?: boolean;
    tsType?: string;
}

interface GValueSetterInfo {
    staticConstructor?: string;
    /**
     * GLib type name. For boxed setters, identifies the boxed `GType` the JS
     * value marshals into. For `isFundamental`-style setters, used to
     * initialize a fresh `GValue`.
     */
    gtypeName?: string;
    setMethod?: string;
    isEnum?: boolean;
    isFlags?: boolean;
    isClass?: boolean;
    isInterface?: boolean;
    isFundamental?: boolean;
}
