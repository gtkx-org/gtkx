import type { GirRepository, NormalizedClass, NormalizedProperty } from "@gtkx/gir";
import { parseQualifiedName } from "@gtkx/gir";
import { APPLICATION_PARAM_NAME } from "../constants/index.js";
import type { PropertyAnalysis } from "../generator-types.js";
import type { FfiMapper } from "../type-system/ffi-mapper.js";
import { collectExternalNamespaces } from "../type-system/ffi-types.js";
import { collectDirectMembers, collectParentPropertyNames } from "../utils/class-traversal.js";
import { kebabToSnake, snakeToKebab, toCamelCase } from "../utils/naming.js";
import { qualifyType } from "../utils/type-qualification.js";

/**
 * Analyzes properties for JSX component generation.
 * Works directly with NormalizedClass and FfiMapper.
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
    analyzeWidgetProperties(cls: NormalizedClass, hiddenProps: Set<string> = new Set()): PropertyAnalysis[] {
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

    private analyzeProperty(
        prop: NormalizedProperty,
        cls: NormalizedClass,
        requiredParams: Set<string>,
    ): PropertyAnalysis {
        const { namespace } = parseQualifiedName(cls.qualifiedName);
        const typeMapping = this.ffiMapper.mapType(prop.type);

        return {
            name: prop.name,
            camelName: toCamelCase(prop.name),
            type: qualifyType(typeMapping.ts, namespace),
            isRequired: requiredParams.has(prop.name) || requiredParams.has(kebabToSnake(prop.name)),
            isWritable: prop.writable,
            getter: prop.getter,
            setter: prop.setter,
            doc: prop.doc,
            referencedNamespaces: collectExternalNamespaces(typeMapping.imports),
        };
    }

    private getRequiredConstructorParams(cls: NormalizedClass): Set<string> {
        const required = new Set<string>();
        const mainCtor = cls.getConstructor("new");
        if (!mainCtor) return required;

        for (const param of mainCtor.parameters) {
            if (!param.nullable && !param.optional) {
                if (param.name === APPLICATION_PARAM_NAME) continue;
                required.add(snakeToKebab(param.name));
            }
        }

        return required;
    }
}
