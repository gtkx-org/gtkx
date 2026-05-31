import { camelCase, toIdentifier } from "@gtkx/utils";

/**
 * Derives the public camelCase export name for a namespace-level callable.
 *
 * Strips the namespace's `c:symbol-prefixes` value from the C identifier
 * (e.g. `g_` from `g_quark_from_string`) and camelCases the remainder
 * (`quarkFromString`). When no prefix matches, the GIR `name` attribute is
 * camelCased as a fallback. The result is escaped so it never collides with a
 * reserved word.
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
        return toIdentifier(camelCase(girName));
    }
    return toIdentifier(camelCase(stripped));
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
