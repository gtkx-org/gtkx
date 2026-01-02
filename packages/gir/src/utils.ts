/**
 * Naming utilities for GIR identifiers.
 */

/** Converts kebab-case or snake_case to camelCase */
export const toCamelCase = (str: string): string => str.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());

/** Converts kebab-case or snake_case to PascalCase */
export const toPascalCase = (str: string): string => {
    const camel = toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
};
