import { toCamelCase, toIdentifier } from "@gtkx/utils";

/**
 * Derives the public camelCase export name for a namespace-level callable.
 *
 * The GIR `name` attribute is camelCased (`quark_from_string` →
 * `quarkFromString`); for a shadowing function it is the shadowed short name,
 * so `g_idle_add_full` (which shadows `idle_add`) exports as `idleAdd`. When the
 * `name` is empty the C identifier is used instead, with the namespace's
 * `c:symbol-prefixes` value stripped (e.g. `g_` from `g_quark_from_string`).
 * The result is escaped so it never collides with a reserved word.
 *
 * @param cIdentifier - The C symbol identifier from GIR
 * @param girName - The GIR `name` attribute (shadow-resolved)
 * @param symbolPrefixes - The namespace's `c:symbol-prefixes` values
 */
export const namespaceFunctionExportName = (
    cIdentifier: string,
    girName: string,
    symbolPrefixes: readonly string[],
): string => {
    if (girName.length > 0) {
        return toIdentifier(toCamelCase(girName));
    }
    const stripped = stripLongestPrefix(cIdentifier, symbolPrefixes);
    return toIdentifier(toCamelCase(stripped));
};

/**
 * Derives the exported identifier for a GIR `<alias>`.
 *
 * Aliases are surfaced under their GIR `name` (e.g. `Quark`, `Pid`,
 * `Allocation`), matching the `@girs` convention. GObject's `Type` alias is the
 * one exception: it is published as `GType` so it lines up with the GObject
 * runtime's `GType` type and the references that resolve through it.
 *
 * @param namespaceName - The namespace the alias is declared in
 * @param aliasName - The alias's GIR `name`
 */
export const aliasExportName = (namespaceName: string, aliasName: string): string =>
    namespaceName === "GObject" && aliasName === "Type" ? "GType" : aliasName;

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
