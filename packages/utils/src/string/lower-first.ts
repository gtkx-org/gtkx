/**
 * Converts the first character of a string to lower case.
 *
 * @param str - The string to transform.
 * @returns The string with its first character lower-cased.
 *
 * @example
 * lowerFirst("Fred"); // "fred"
 * lowerFirst("FRED"); // "fRED"
 */
function lowerFirst(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
}

export { lowerFirst };
