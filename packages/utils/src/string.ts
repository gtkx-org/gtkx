/**
 * Returns the string with its first character uppercased.
 *
 * @param value The string to transform.
 */
export const upperFirst = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Returns the string with its first character lowercased.
 *
 * @param value The string to transform.
 */
export const lowerFirst = (value: string): string => value.charAt(0).toLowerCase() + value.slice(1);

const splitWords = (input: string): string[] => input.split(/[_-]/g).filter((part) => part.length > 0);

/**
 * Converts an underscore- or hyphen-delimited string to camelCase.
 *
 * @param input The string to convert.
 */
export const toCamelCase = (input: string): string => {
    const parts = splitWords(input);
    if (parts.length === 0) return input;
    return parts.map((part, index) => (index === 0 ? part : upperFirst(part))).join("");
};

/**
 * Converts an underscore- or hyphen-delimited string to PascalCase.
 *
 * @param input The string to convert.
 */
export const toPascalCase = (input: string): string => {
    const parts = splitWords(input);
    if (parts.length === 0) return input;
    return parts.map(upperFirst).join("");
};

/**
 * Converts a camelCase or PascalCase string to kebab-case by lowercasing uppercase letters and
 * inserting hyphens before interior ones.
 *
 * @param input The string to convert.
 */
export const toKebabCase = (input: string): string =>
    input.replaceAll(/[A-Z]/g, (char, index: number) => (index === 0 ? char.toLowerCase() : `-${char.toLowerCase()}`));
