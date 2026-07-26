/**
 * Converts the first character of a string to upper case.
 *
 * @param str - The string to transform.
 * @returns The string with its first character upper-cased.
 *
 * @example
 * upperFirst("fred"); // "Fred"
 * upperFirst("Fred"); // "Fred"
 */
function upperFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export { upperFirst };
