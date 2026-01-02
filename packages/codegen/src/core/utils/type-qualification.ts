/**
 * Type Qualification Utilities
 *
 * SINGLE SOURCE OF TRUTH for type namespace qualification.
 * Used by PropertyAnalyzer, SignalAnalyzer, and WidgetPropsBuilder.
 */

/**
 * TypeScript primitive types that don't need namespace qualification.
 */
const TS_PRIMITIVES = new Set(["boolean", "number", "string", "void", "unknown", "null", "undefined"]);

/**
 * Qualifies a TypeScript type with a namespace prefix if needed.
 *
 * Primitives, already-qualified types, and complex types (generics, functions)
 * are returned unchanged. Simple type names get the namespace prefix.
 *
 * @param tsType - The TypeScript type string to qualify
 * @param namespace - The namespace to use for qualification
 * @returns The qualified type string
 *
 * @example
 * qualifyType("Button", "Gtk") // => "Gtk.Button"
 * qualifyType("string", "Gtk") // => "string"
 * qualifyType("Gio.File", "Gtk") // => "Gio.File"
 * qualifyType("Button[]", "Gtk") // => "Gtk.Button[]"
 */
export const qualifyType = (tsType: string, namespace: string): string => {
    if (TS_PRIMITIVES.has(tsType)) {
        return tsType;
    }

    if (tsType.endsWith("[]")) {
        const elementType = tsType.slice(0, -2);

        if (TS_PRIMITIVES.has(elementType)) {
            return tsType;
        }

        if (elementType.includes(".") || elementType.includes("<") || elementType.includes("(")) {
            return tsType;
        }

        return `${namespace}.${elementType}[]`;
    }

    if (tsType.includes(".") || tsType.includes("<") || tsType.includes("(")) {
        return tsType;
    }

    return `${namespace}.${tsType}`;
};

/**
 * Formats a return type with nullable handling.
 *
 * @param baseType - The base TypeScript type from the mapper
 * @param isNullable - Whether the return type is nullable
 * @returns The formatted return type string, with `| null` appended if nullable and not void
 *
 * @example
 * formatNullableReturn("Button", true)  // => "Button | null"
 * formatNullableReturn("Button", false) // => "Button"
 * formatNullableReturn("void", true)    // => "void"
 */
export const formatNullableReturn = (baseType: string, isNullable: boolean): string => {
    if (baseType === "void") return "void";
    return isNullable ? `${baseType} | null` : baseType;
};
