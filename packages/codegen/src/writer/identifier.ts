import { toCamelIdentifier } from "@gtkx/utils";

export const namespaceFunctionExportName = (cIdentifier: string, girName: string, symbolPrefixes: string[]): string => {
    if (girName.length > 0) {
        return toCamelIdentifier(girName);
    }
    const stripped = stripLongestPrefix(cIdentifier, symbolPrefixes);
    return toCamelIdentifier(stripped);
};

export const aliasExportName = (namespaceName: string, aliasName: string): string =>
    namespaceName === "GObject" && aliasName === "Type" ? "GType" : aliasName;

export const bindingIdentifier = (cIdentifier: string): string => toCamelIdentifier(cIdentifier);

const stripLongestPrefix = (input: string, prefixes: string[]): string => {
    let best = "";
    for (const prefix of prefixes) {
        const candidate = `${prefix}_`;
        if (input.startsWith(candidate) && candidate.length > best.length) {
            best = candidate;
        }
    }
    return best.length === 0 ? input : input.slice(best.length);
};
