import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { UserRules } from "@gtkx/codegen";
import { createJiti } from "jiti";

/**
 * Resolves and loads the optional `rules` module declared in `gtkx.config.ts`.
 *
 * The config field is a module specifier, not a filesystem path, so it is
 * resolved and imported through `jiti` exactly as the virtual module imports it
 * at runtime: bare package specifiers, subpath exports, relative paths, and
 * TypeScript sources all resolve identically, and TS sources load even from the
 * compiled CLI where Node has no TypeScript loader.
 */

const jitiFor = (cwd: string) => createJiti(pathToFileURL(join(cwd, "noop.js")).href);

/**
 * Imports the rules module and returns its default-exported
 * `(builtins) => registry` function, or `undefined` when no `rules` specifier
 * is configured.
 */
export const loadUserRules = async (cwd: string, specifier: string | undefined): Promise<UserRules | undefined> => {
    if (specifier === undefined) return undefined;
    return jitiFor(cwd).import<UserRules>(specifier, { default: true });
};

/**
 * Reads the source text of the resolved rules module for codegen fingerprinting,
 * returning an empty string when no specifier is configured or it cannot be
 * resolved to a readable file.
 */
export const readUserRulesSource = (cwd: string, specifier: string | undefined): string => {
    if (specifier === undefined) return "";
    try {
        return readFileSync(fileURLToPath(jitiFor(cwd).esmResolve(specifier)), "utf8");
    } catch {
        return "";
    }
};
