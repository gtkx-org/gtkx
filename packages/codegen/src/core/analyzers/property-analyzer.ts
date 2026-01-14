import type { GirClass, GirProperty, GirRepository } from "@gtkx/gir";
import { parseQualifiedName } from "@gtkx/gir";
import { APPLICATION_PARAM_NAME } from "../constants/index.js";
import type { PropertyAnalysis } from "../generator-types.js";
import type { FfiMapper } from "../type-system/ffi-mapper.js";
import { collectExternalNamespaces } from "../type-system/ffi-types.js";
import { collectDirectMembers, collectParentPropertyNames } from "../utils/class-traversal.js";
import { collectPropertiesWithDefaults } from "../utils/default-value.js";
import { kebabToSnake, snakeToKebab, toCamelCase } from "../utils/naming.js";
import { qualifyType } from "../utils/type-qualification.js";

/**
 * Analyzes properties for JSX component generation.
 * Works directly with GirClass and FfiMapper.
 */
export class PropertyAnalyzer {
    constructor(
        private readonly repo: GirRepository,
        private readonly ffiMapper: FfiMapper,
    ) {}

    /**
     * Analyzes properties for a widget class.
     * Returns only the properties directly defined on this class (not inherited from any parent).
     */
    analyzeWidgetProperties(cls: GirClass, hiddenProps: Set<string> = new Set()): PropertyAnalysis[] {
        const requiredParams = this.getRequiredConstructorParams(cls);

        const directProps = collectDirectMembers({
            cls,
            repo: this.repo,
            getClassMembers: (c) => c.properties,
            getInterfaceMembers: (i) => i.properties,
            getParentNames: collectParentPropertyNames,
            transformName: toCamelCase,
            isHidden: (name) => hiddenProps.has(name),
        });

        return directProps.map((prop) => this.analyzeProperty(prop, cls, requiredParams));
    }

    private analyzeProperty(prop: GirProperty, cls: GirClass, requiredParams: Set<string>): PropertyAnalysis {
        const { namespace } = parseQualifiedName(cls.qualifiedName);
        const typeMapping = this.ffiMapper.mapType(prop.type, false, prop.type.transferOwnership);

        const getter = this.resolveAccessorName(prop.getter, cls);
        let setter = this.resolveAccessorName(prop.setter, cls);

        const needsSyntheticSetter = prop.writable && !prop.constructOnly && !setter;
        if (needsSyntheticSetter && this.canGenerateSyntheticSetter(prop)) {
            const camelName = toCamelCase(prop.name);
            setter = `set${camelName.charAt(0).toUpperCase()}${camelName.slice(1)}`;
        }

        const isNullable = prop.type.nullable || this.inferNullabilityFromGetter(prop.getter, cls);

        return {
            name: prop.name,
            camelName: toCamelCase(prop.name),
            type: qualifyType(typeMapping.ts, namespace),
            isRequired: requiredParams.has(prop.name) || requiredParams.has(kebabToSnake(prop.name)),
            isWritable: prop.writable,
            isNullable,
            getter,
            setter,
            doc: prop.doc,
            referencedNamespaces: collectExternalNamespaces(typeMapping.imports),
            hasSyntheticSetter: needsSyntheticSetter && this.canGenerateSyntheticSetter(prop),
        };
    }

    private inferNullabilityFromGetter(getterName: string | undefined, cls: GirClass): boolean {
        if (!getterName) return false;

        const method = cls.findMethod(getterName);
        if (!method) return false;

        return method.returnType.nullable;
    }

    private canGenerateSyntheticSetter(prop: GirProperty): boolean {
        const typeName = String(prop.type.name);
        const typeMapping = this.ffiMapper.mapType(prop.type, false, prop.type.transferOwnership);

        const supportedPrimitives = new Set([
            "utf8",
            "gchararray",
            "gboolean",
            "gint",
            "gint32",
            "guint",
            "guint32",
            "gint64",
            "guint64",
            "gfloat",
            "gdouble",
            "glong",
            "gulong",
        ]);

        if (supportedPrimitives.has(typeName)) {
            return true;
        }

        if (typeMapping.kind === "enum" || typeMapping.kind === "flags") {
            return true;
        }

        if (typeMapping.kind === "class" || typeMapping.kind === "interface") {
            return true;
        }

        return false;
    }

    private resolveAccessorName(accessor: string | undefined, cls: GirClass): string | undefined {
        if (!accessor) return undefined;

        const method = cls.getMethodByCIdentifier(accessor);
        if (method) {
            return method.name;
        }

        return accessor;
    }

    private getRequiredConstructorParams(cls: GirClass): Set<string> {
        const required = new Set<string>();
        const mainCtor = cls.getConstructor("new");
        if (!mainCtor) return required;

        const propsWithDefaults = collectPropertiesWithDefaults(cls, this.repo);

        for (const param of mainCtor.parameters) {
            if (!param.nullable && !param.optional) {
                if (param.name === APPLICATION_PARAM_NAME) continue;
                const kebabName = snakeToKebab(param.name);
                if (propsWithDefaults.has(param.name) || propsWithDefaults.has(kebabName)) {
                    continue;
                }
                required.add(kebabName);
            }
        }

        return required;
    }
}
