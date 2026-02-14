/**
 * Constructor Analyzer
 *
 * Analyzes GIR constructors to determine which properties are constructor parameters.
 */

import type { GirClass, GirRepository } from "@gtkx/gir";
import { APPLICATION_PARAM_NAME } from "../constants/index.js";
import { snakeToKebab, toCamelCase } from "../utils/naming.js";

/**
 * Analyzes constructors to determine constructor parameters.
 *
 * @example
 * ```typescript
 * const analyzer = new ConstructorAnalyzer(repository);
 * const paramNames = analyzer.getConstructorParamNames(widgetClass);
 * // Returns: ["orientation", "spacing"]
 * ```
 */
export class ConstructorAnalyzer {
    constructor(private readonly repository: GirRepository) {}

    /**
     * Gets constructor parameters for a class.
     *
     * Looks at the "new" constructor and extracts parameters that:
     * 1. Are not the "application" parameter (handled specially)
     * 2. Have a corresponding property on the class or its interfaces
     */
    private getConstructorParams(cls: GirClass): Array<{ name: string; camelName: string; optional: boolean }> {
        const mainCtor = cls.getConstructor("new");

        if (!mainCtor) {
            return cls
                .getAllProperties()
                .filter((p) => p.constructOnly)
                .map((p) => ({ name: p.name, camelName: toCamelCase(p.name), optional: true }));
        }

        const params: Array<{ name: string; camelName: string; optional: boolean }> = [];

        const propertyNames = new Set(cls.getAllProperties().map((p) => p.name));

        for (const ifaceQName of cls.getAllImplementedInterfaces()) {
            const iface = this.repository.resolveInterface(ifaceQName);
            if (iface) {
                for (const prop of iface.properties) {
                    propertyNames.add(prop.name);
                }
            }
        }

        for (const param of mainCtor.parameters) {
            if (param.name === APPLICATION_PARAM_NAME) continue;

            const propName = snakeToKebab(param.name);
            const matchesProperty = propertyNames.has(propName) || propertyNames.has(param.name);

            if (!matchesProperty) continue;

            params.push({
                name: propName,
                camelName: toCamelCase(propName),
                optional: param.nullable || param.optional,
            });
        }

        const required = params.filter((p) => !p.optional);
        const optional = params.filter((p) => p.optional);

        const coveredNames = new Set(params.map((p) => p.name));
        const uncoveredConstructOnly = cls
            .getAllProperties()
            .filter((p) => p.constructOnly && !coveredNames.has(p.name))
            .map((p) => ({ name: p.name, camelName: toCamelCase(p.name), optional: true }));

        return [...required, ...optional, ...uncoveredConstructOnly];
    }

    /**
     * Gets constructor parameter names in camelCase.
     * This is the format used by internal.ts CONSTRUCTOR_PROPS.
     *
     * @param cls - The normalized class to analyze
     * @returns Array of camelCase parameter names
     */
    getConstructorParamNames(cls: GirClass): string[] {
        return this.getConstructorParams(cls).map((p) => p.camelName);
    }
}
