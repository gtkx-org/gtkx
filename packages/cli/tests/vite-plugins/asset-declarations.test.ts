import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ResolveIdHook } from "./plugin-hook-types.js";
import { DATA_IMPORT_PREFIX } from "../../src/internal/data-dir.js";
import { ASSET_EXTENSIONS } from "../../src/vite-plugins/asset-extensions.js";
import { gtkxResources } from "../../src/vite-plugins/resources.js";

type DeclaredModule = {
    body: string;
    pattern: string;
};

const ENV_DECLARATIONS = join(import.meta.dirname, "..", "..", "env.d.ts");
const DECLARE_MODULE_RE = /^declare module "([^"]+)" \{$([\s\S]*?)^\}$/gm;
const DATA_PATTERN_PREFIX = `${DATA_IMPORT_PREFIX}/*.`;
const PATH_EXPORT = "export const path: string;";
const RELATIVE_ONLY_EXTENSIONS = new Set(["data", "gpa"]);

const declaredModules = (): DeclaredModule[] =>
    readFileSync(ENV_DECLARATIONS, "utf8")
        .matchAll(DECLARE_MODULE_RE)
        .map((match) => ({ body: match[2] ?? "", pattern: match[1] ?? "" }))
        .toArray();

const patternsExportingPath = (): string[] =>
    declaredModules().filter((entry) => entry.body.includes(PATH_EXPORT)).map((entry) => entry.pattern);

const dataPatternsFor = (extensions: string[]): string[] =>
    extensions.map((extension) => `${DATA_PATTERN_PREFIX}${extension}`);

const sorted = (values: string[]): string[] => values.toSorted((left, right) => left.localeCompare(right));

const resolveAssetImport = (source: string): Promise<string | undefined | null> => {
    const plugin = gtkxResources();
    const resolve = (id: string): Promise<{ id: string }> => Promise.resolve({ id: `/abs/${id}` });

    return Promise.resolve((plugin.resolveId as ResolveIdHook).call({ resolve }, source));
};

describe("@gtkx/cli/env asset declarations", () => {
    it("promises a GResource path only for specifiers rooted at the data import prefix", () => {
        const stray = patternsExportingPath().filter((pattern) => !pattern.startsWith(`${DATA_IMPORT_PREFIX}/`));
        expect(stray).toEqual([]);
    });

    it("promises a GResource path for exactly the extensions the resources plugin rewrites", () => {
        expect(sorted(patternsExportingPath())).toEqual(sorted(dataPatternsFor(ASSET_EXTENSIONS)));
    });

    it("gives every data-scoped asset the resource URI default the plugin emits", () => {
        const scoped = declaredModules().filter((entry) => entry.pattern.startsWith(DATA_PATTERN_PREFIX));
        expect(scoped).toHaveLength(ASSET_EXTENSIONS.length);
        expect(scoped.every((entry) => entry.body.includes("export default resourceUri;"))).toBe(true);
    });

    it("types the extensions vite/client leaves undeclared by the filesystem path they yield", () => {
        const relative = declaredModules().filter((entry) => RELATIVE_ONLY_EXTENSIONS.has(entry.pattern.slice(2)));
        expect(relative.map((entry) => entry.pattern)).toEqual(["*.data", "*.gpa"]);
        expect(relative.every((entry) => !entry.body.includes(PATH_EXPORT))).toBe(true);
    });
});

describe("gtkxResources (declared scope)", () => {
    it("rewrites a data-scoped import for every declared asset extension", async () => {
        const resolved = await Promise.all(
            ASSET_EXTENSIONS.map((extension) => resolveAssetImport(`${DATA_IMPORT_PREFIX}/asset.${extension}`)),
        );

        expect(resolved.every((id) => typeof id === "string")).toBe(true);
    });

    it("leaves a relative import of every declared asset extension to the Vite asset pipeline", async () => {
        const resolved = await Promise.all(
            ASSET_EXTENSIONS.map((extension) => resolveAssetImport(`./asset.${extension}`)),
        );

        expect(resolved.filter((id) => id !== undefined)).toEqual([]);
    });
});
