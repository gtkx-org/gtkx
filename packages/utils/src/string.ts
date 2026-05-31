/**
 * Pure, runtime-agnostic string-case helpers shared across GTKX packages.
 *
 * GTKX bridges several casing conventions: GIR uses snake_case for symbols,
 * kebab-case for properties and signals, and PascalCase for types, while the
 * JavaScript surface uses camelCase for members and PascalCase for types. The
 * helpers below codify the conversions between those shapes. They split only
 * on underscores and hyphens and preserve the case of each segment, so they
 * are not a substitute for a full Unicode-aware case transform.
 */

/**
 * Uppercases the first character of `value`, leaving the remaining characters
 * untouched.
 *
 * The tail is preserved verbatim rather than lowercased, so
 * `upperFirst("fooBar")` is `"FooBar"` and `upperFirst("URL")` is `"URL"`. An
 * empty string returns an empty string.
 *
 * @param value - The string to transform.
 * @returns `value` with its first character uppercased.
 */
export const upperFirst = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Converts a snake_case or kebab-case string to camelCase.
 *
 * The input is split on underscores and hyphens, dropping empty segments from
 * leading, trailing, or repeated separators. The first segment is kept
 * verbatim and every later segment is {@link upperFirst}-cased before joining,
 * so `camelCase("icon_name")` is `"iconName"` and `camelCase("Box")` is
 * `"Box"`. A string with no separators is returned unchanged.
 *
 * @param input - The snake_case or kebab-case identifier.
 * @returns The camelCase form of `input`.
 */
export const camelCase = (input: string): string => {
    const parts = input.split(/[_-]/g).filter((part) => part.length > 0);
    if (parts.length === 0) return input;
    const [first, ...rest] = parts;
    const head = first ?? "";
    return head + rest.map(upperFirst).join("");
};

/**
 * Converts a snake_case, kebab-case, or already-PascalCase string to
 * PascalCase.
 *
 * The input is split on underscores and hyphens, dropping empty segments, and
 * every remaining segment is {@link upperFirst}-cased before joining, so
 * `pascalCase("icon_name")` is `"IconName"` and `pascalCase("Box")` is
 * `"Box"`. An empty string is returned unchanged.
 *
 * @param input - The identifier to transform.
 * @returns The PascalCase form of `input`.
 */
export const pascalCase = (input: string): string => {
    if (input.length === 0) return input;
    const parts = input.split(/[_-]/g).filter((part) => part.length > 0);
    if (parts.length === 0) return input;
    return parts.map(upperFirst).join("");
};

/**
 * Converts a camelCase or PascalCase string to kebab-case.
 *
 * Each uppercase character is lowercased; every uppercase character other than
 * the first is additionally prefixed with a hyphen, so `kebabCase("iconName")`
 * is `"icon-name"` and `kebabCase("Title")` is `"title"`. The leading
 * character is never prefixed with a hyphen.
 *
 * @param input - The camelCase or PascalCase identifier.
 * @returns The kebab-case form of `input`.
 */
export const kebabCase = (input: string): string =>
    input.replaceAll(/[A-Z]/g, (char, index: number) => (index === 0 ? char.toLowerCase() : `-${char.toLowerCase()}`));
