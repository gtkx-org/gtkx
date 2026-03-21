import type { GirClass, GirProperty, GirRepository, QualifiedName } from "@gtkx/gir";
import type { MethodDeclarationStructure, WriterFunction } from "ts-morph";
import { StructureKind } from "ts-morph";
import type { GenerationContext } from "../../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import { getSyntheticGetterPrimitiveInfo, type MappedType } from "../../../core/type-system/ffi-types.js";
import {
    collectDirectMembers,
    collectOwnAndInterfaceMethodNames,
    collectParentMethodNames,
    collectParentPropertyNames,
} from "../../../core/utils/class-traversal.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import { createGetterName, toCamelCase } from "../../../core/utils/naming.js";

export class PropertyGetterBuilder {
    private readonly existingMethodNames: Set<string>;

    constructor(
        private readonly cls: GirClass,
        private readonly ffiMapper: FfiMapper,
        private readonly ctx: GenerationContext,
        private readonly repository: GirRepository,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.existingMethodNames = collectOwnAndInterfaceMethodNames(cls, repository, toCamelCase);
        for (const name of collectParentMethodNames(cls, repository)) {
            this.existingMethodNames.add(toCamelCase(name));
        }
    }

    buildStructures(): MethodDeclarationStructure[] {
        const propertiesNeedingSyntheticGetters = this.collectPropertiesNeedingSyntheticGetters();
        return propertiesNeedingSyntheticGetters
            .map((prop) => this.buildGetterStructure(prop))
            .filter((s): s is MethodDeclarationStructure => s !== null);
    }

    private collectPropertiesNeedingSyntheticGetters(): GirProperty[] {
        const directProps = collectDirectMembers({
            cls: this.cls,
            repo: this.repository,
            getClassMembers: (c) => c.properties,
            getInterfaceMembers: (i) => i.properties,
            getParentNames: collectParentPropertyNames,
            transformName: toCamelCase,
            isHidden: () => false,
        });

        return directProps.filter((prop) => {
            if (!prop.readable || prop.getter) {
                return false;
            }

            const getterName = createGetterName(toCamelCase(prop.name));
            return !this.existingMethodNames.has(getterName);
        });
    }

    private buildGetterStructure(prop: GirProperty): MethodDeclarationStructure | null {
        const typeMapping = this.ffiMapper.mapType(prop.type, false, prop.type.transferOwnership);
        const gvalueGetterInfo = this.getGValueGetterInfo(prop, typeMapping);

        if (!gvalueGetterInfo) {
            return null;
        }

        const methodName = createGetterName(toCamelCase(prop.name));
        let returnType = typeMapping.ts;
        const isNullable = typeMapping.nullable ?? false;

        if (
            (gvalueGetterInfo.isInterface || gvalueGetterInfo.isBoxed || gvalueGetterInfo.isFundamental) &&
            !isNullable
        ) {
            returnType = `${returnType} | null`;
        }

        this.ctx.addTypeImports(typeMapping.imports);

        return {
            kind: StructureKind.Method,
            name: methodName,
            parameters: [],
            returnType,
            docs: buildJsDocStructure(
                prop.doc ? `Gets ${prop.doc}` : `Gets the ${prop.name} property.`,
                this.options.namespace,
            ),
            statements: this.writeGetterBody(prop.name, gvalueGetterInfo, returnType),
        };
    }

    private getGValueGetterInfo(prop: GirProperty, typeMapping: MappedType): GValueGetterInfo | null {
        const typeName = String(prop.type.name);
        const primitiveInfo = getSyntheticGetterPrimitiveInfo(typeName);
        if (primitiveInfo) {
            return primitiveInfo;
        }

        if (typeMapping.kind === "enum") {
            return { gtypeName: "gint", getMethod: "getEnum", isEnum: true };
        }

        if (typeMapping.kind === "flags") {
            return { gtypeName: "guint", getMethod: "getFlags", isFlags: true };
        }

        if (typeMapping.kind === "class") {
            const fundamentalInfo = this.getFundamentalClassGetterInfo(typeName, typeMapping);
            if (fundamentalInfo) {
                return fundamentalInfo;
            }
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
        const cls = this.repository.resolveClass(qualifiedName as QualifiedName);
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
                gtypeName: typeMapping.ffi.innerType as string,
                getMethod: "getBoxed",
                isBoxed: true,
                tsType: typeMapping.ts,
            };
        }

        if (typeMapping.ffi.type === "fundamental") {
            const qualifiedName = typeName.includes(".") ? typeName : `${this.options.namespace}.${typeName}`;
            const record = this.repository.resolveRecord(qualifiedName as QualifiedName);
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

    private writeGetterBody(propertyName: string, getterInfo: GValueGetterInfo, returnType: string): WriterFunction {
        this.ctx.usesCall = true;
        this.ctx.usesSyntheticPropertyGetter = true;

        const isGObjectNamespace = this.options.namespace === "GObject";
        const gobjectPrefix = isGObjectNamespace ? "" : "GObject.";

        return (writer) => {
            writer.writeLine(`const gvalue = new ${gobjectPrefix}Value();`);

            if (getterInfo.gtypeName) {
                writer.writeLine(`gvalue.init(${gobjectPrefix}typeFromName("${getterInfo.gtypeName}"));`);
            } else {
                writer.writeLine(`gvalue.init(${gobjectPrefix}typeFromName("GObject"));`);
            }

            writer.writeLine("call(");
            writer.indent(() => {
                writer.writeLine(`"libgobject-2.0.so.0",`);
                writer.writeLine(`"g_object_get_property",`);
                writer.writeLine("[");
                writer.indent(() => {
                    writer.writeLine(`{ type: { type: "gobject", ownership: "borrowed" }, value: this.handle },`);
                    writer.writeLine(`{ type: { type: "string", ownership: "borrowed" }, value: "${propertyName}" },`);
                    writer.writeLine(
                        `{ type: { type: "boxed", ownership: "borrowed", innerType: "GValue", library: "libgobject-2.0.so.0", getTypeFn: "g_value_get_type" }, value: gvalue.handle },`,
                    );
                });
                writer.writeLine("],");
                writer.writeLine(`{ type: "undefined" }`);
            });
            writer.writeLine(");");

            if (getterInfo.isBoxed) {
                writer.writeLine(`return gvalue.${getterInfo.getMethod}(${getterInfo.tsType});`);
            } else if (getterInfo.isFundamental) {
                writer.writeLine(`return gvalue.${getterInfo.getMethod}() as ${returnType};`);
            } else if (getterInfo.isClass || getterInfo.isInterface) {
                writer.writeLine(`return gvalue.${getterInfo.getMethod}() as ${returnType};`);
            } else if (getterInfo.isEnum || getterInfo.isFlags) {
                writer.writeLine(`return gvalue.${getterInfo.getMethod}() as ${returnType};`);
            } else if (getterInfo.isString) {
                writer.writeLine(`return gvalue.${getterInfo.getMethod}() as ${returnType};`);
            } else {
                writer.writeLine(`return gvalue.${getterInfo.getMethod}();`);
            }
        };
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
