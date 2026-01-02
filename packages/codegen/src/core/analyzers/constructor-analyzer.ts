/**
 * Constructor Analyzer
 *
 * Analyzes GIR constructors to determine which properties are constructor parameters.
 * Replaces the "first 3 props" heuristic with actual constructor analysis.
 */

import type { GirRepository, NormalizedClass } from "@gtkx/gir";
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
    private getConstructorParams(cls: NormalizedClass): Array<{ name: string; camelName: string }> {
        const mainCtor = cls.getConstructor("new");
        if (!mainCtor) return [];

        const params: Array<{ name: string; camelName: string }> = [];

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

            if (!propertyNames.has(propName) && !propertyNames.has(param.name)) {
                continue;
            }

            params.push({
                name: propName,
                camelName: toCamelCase(propName),
            });
        }

        return params;
    }

    /**
     * Gets constructor parameter names in camelCase.
     * This is the format used by internal.ts CONSTRUCTOR_PROPS.
     *
     * @param cls - The normalized class to analyze
     * @returns Array of camelCase parameter names
     */
    getConstructorParamNames(cls: NormalizedClass): string[] {
        return this.getConstructorParams(cls).map((p) => p.camelName);
    }
}
