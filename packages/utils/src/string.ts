/**
 * Upper-cases the first character of a string, leaving the rest unchanged.
 *
 * @param value - the input string
 * @returns the string with its first character upper-cased
 */
export const toUpperFirst = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Lower-cases the first character of a string, leaving the rest unchanged.
 *
 * @param value - the input string
 * @returns the string with its first character lower-cased
 */
export const toLowerFirst = (value: string): string => value.charAt(0).toLowerCase() + value.slice(1);

const splitWords = (input: string): string[] => input.split(/[_-]/g).filter((part) => part.length > 0);

/**
 * Converts a snake_case or kebab-case string to camelCase.
 *
 * Splits on `_` and `-`, lower-cases the first word, and upper-cases the first
 * character of each subsequent word. A string with no separators is returned
 * unchanged.
 *
 * @param input - the snake_case or kebab-case string
 * @returns the camelCase form
 */
export const toCamelCase = (input: string): string => {
    const parts = splitWords(input);
    if (parts.length === 0) return input;
    const [first, ...rest] = parts;
    const head = first ?? "";
    return head + rest.map(toUpperFirst).join("");
};

/**
 * Converts a snake_case or kebab-case string to PascalCase.
 *
 * Splits on `_` and `-` and upper-cases the first character of every word. A
 * string with no separators is returned unchanged.
 *
 * @param input - the snake_case or kebab-case string
 * @returns the PascalCase form
 */
export const toPascalCase = (input: string): string => {
    const parts = splitWords(input);
    if (parts.length === 0) return input;
    return parts.map(toUpperFirst).join("");
};

/**
 * Converts a camelCase or PascalCase string to kebab-case.
 *
 * Each upper-case letter (other than a leading one) is replaced with a hyphen
 * followed by its lower-case form.
 *
 * @param input - the camelCase or PascalCase string
 * @returns the kebab-case form
 */
export const toKebabCase = (input: string): string =>
    input.replaceAll(/[A-Z]/g, (char, index: number) => (index === 0 ? char.toLowerCase() : `-${char.toLowerCase()}`));
