import { escapeReserved, toCamelCase, toPascalCase } from "../gir/rename.js";

/**
 * Identifier-shaping helpers re-exported under a stable name so writers
 * import naming concerns from `dsl/identifier.js` rather than reaching
 * into the GIR layer for them.
 *
 * `camelCase` escapes JavaScript reserved words (for use as variable or
 * parameter identifiers) by appending an underscore. {@link camelCaseMember}
 * does not — class member names tolerate reserved words like `delete` or
 * `new`, and escaping them would break consumer code that calls
 * `buffer.delete(...)`.
 */
export const camelCase = (input: string): string => escapeReserved(toCamelCase(input));

/**
 * Like {@link camelCase} but does not escape reserved words. Use this for
 * class method or property names where reserved words are legal in modern
 * JavaScript.
 */
export const camelCaseMember = (input: string): string => toCamelCase(input);

/**
 * PascalCase shaping for type-position identifiers (class names, enum
 * names, …). Reserved-word escaping is generally unnecessary at type
 * position but kept for symmetry.
 *
 * @param input - The raw identifier
 */
export const pascalCase = (input: string): string => toPascalCase(input);

/**
 * Derives the public camelCase export name for a namespace-level callable.
 *
 * Strips the namespace's `c:symbol-prefixes` value from the C identifier
 * (e.g. `g_` from `g_quark_from_string`) and camelCases the remainder
 * (`quarkFromString`). When no prefix matches, the GIR `name` attribute is
 * camelCased as a fallback.
 *
 * @param cIdentifier - The C symbol identifier from GIR
 * @param girName - The GIR `name` attribute as a fallback
 * @param symbolPrefixes - The namespace's `c:symbol-prefixes` values
 */
export const namespaceFunctionExportName = (
    cIdentifier: string,
    girName: string,
    symbolPrefixes: readonly string[],
): string => {
    const stripped = stripLongestPrefix(cIdentifier, symbolPrefixes);
    if (stripped.length === 0 || stripped === cIdentifier) {
        return camelCase(girName);
    }
    return camelCase(stripped);
};

const stripLongestPrefix = (input: string, prefixes: readonly string[]): string => {
    let best = "";
    for (const prefix of prefixes) {
        const candidate = `${prefix}_`;
        if (input.startsWith(candidate) && candidate.length > best.length) {
            best = candidate;
        }
    }
    return best.length === 0 ? input : input.slice(best.length);
};
