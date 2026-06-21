/**
 * Shared validation primitives for `gtkx.config.ts` user input.
 *
 * Centralizes the two canonical identifier patterns and the array-guard helper
 * that the config and table-schema validators compose, so each check is spelled
 * exactly once.
 */

/**
 * Matches a PascalCase identifier (e.g. a GLib type name or JSX element name):
 * an upper-case letter followed by alphanumerics.
 */
export const PASCAL_CASE_NAME_PATTERN: RegExp = /^[A-Z][A-Za-z0-9]*$/;

/**
 * Matches a camelCase identifier (e.g. a method or slot name): a lower-case
 * letter followed by alphanumerics.
 */
export const CAMEL_CASE_NAME_PATTERN: RegExp = /^[a-z][A-Za-z0-9]*$/;

/**
 * Asserts that `value` is an array, then validates each element through
 * `validateElement`, passing the indexed path so element errors point at the
 * exact position.
 *
 * @param value - the candidate value, validated to be an array
 * @param path - the dotted config path of `value`, used to derive element paths
 * @param validateElement - per-element validator receiving the element and its `path[index]`
 * @param onNotArray - invoked with `path` when `value` is not an array; it must throw
 */
export const validateArrayOf = (
    value: unknown,
    path: string,
    validateElement: (element: unknown, elementPath: string) => void,
    onNotArray: (path: string) => never,
): void => {
    if (!Array.isArray(value)) onNotArray(path);
    value.forEach((element, index) => {
        validateElement(element, `${path}[${index}]`);
    });
};
