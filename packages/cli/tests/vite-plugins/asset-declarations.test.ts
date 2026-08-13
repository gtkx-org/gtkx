import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ResolveIdHook } from "./plugin-hook-types.js";
import { ASSET_EXTENSIONS } from "../../src/vite-plugins/asset-extensions.js";
import { DATA_PREFIX } from "../../src/vite-plugins/asset-specifier.js";
import { RESOURCE_PATH_EXPORT } from "../../src/vite-plugins/resource-shared.js";
import { gtkxResources } from "../../src/vite-plugins/resources.js";

type ScopeCase = { title: string; specifier: (extension: string) => string; isRewritten: boolean };

const ENV_DECLARATIONS = join(import.meta.dirname, "..", "..", "env.d.ts");
const VITE_CLIENT = join(dirname(createRequire(import.meta.url).resolve("vite/package.json")), "client.d.ts");
const VITE_ASSET_MODULE_RE = /declare module ["']\*\.(\w+)["']/g;
const UNDECLARED_BY_VITE = ["data", "gpa"];

const HEADER = [
    "/// <reference types=\"vite/client\" />",
    "/// <reference types=\"@gtkx/react/env\" />",
];

const RESOURCE_BLOCK = [
    "    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */",
    "    const resourceUri: string;",
    "    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */",
    `    export const ${RESOURCE_PATH_EXPORT}: string;`,
    "    export default resourceUri;",
];

const ASSET_URL_BLOCK = [
    "    /**",
    "     * URL of the emitted asset: a dev server URL under `gtkx dev`, an absolute filesystem path once built.",
    "     * Import it under `#data/` instead for a GResource path and a `resource://` URI.",
    "     */",
    "    const assetUrl: string;",
    "    export default assetUrl;",
];

const STYLE_SHEET_BLOCK = [
    "declare module \"*.css?url\" {",
    "    /**",
    "     * URL of the emitted stylesheet, imported without installing it on the default display: a dev server URL",
    "     * under `gtkx dev`, an absolute filesystem path once built.",
    "     */",
    "    const styleSheetUrl: string;",
    "    export default styleSheetUrl;",
    "}",
];

const SCOPE_CASES: ScopeCase[] = [
    {
        title: "rewrites a data-scoped import",
        specifier: (extension) => `${DATA_PREFIX}asset.${extension}`,
        isRewritten: true,
    },
    {
        title: "leaves a relative import to the Vite asset pipeline",
        specifier: (extension) => `./asset.${extension}`,
        isRewritten: false,
    },
    {
        title: "leaves a query-suffixed data-scoped import to the pipeline vite/client types",
        specifier: (extension) => `${DATA_PREFIX}asset.${extension}?url`,
        isRewritten: false,
    },
];

const sorted = (values: string[]): string[] => values.toSorted((left, right) => left.localeCompare(right));

const declaredByVite = (): Set<string> =>
    new Set(readFileSync(VITE_CLIENT, "utf8").matchAll(VITE_ASSET_MODULE_RE).map((match) => match[1] ?? ""));

const undeclaredByVite = (): string[] => {
    const declared = declaredByVite();

    return sorted(ASSET_EXTENSIONS.filter((extension) => !declared.has(extension)));
};

const declarationBlock = (pattern: string, body: string[]): string =>
    [`declare module "${pattern}" {`, ...body, "}"].join("\n");

const resourceBlock = (extension: string): string =>
    declarationBlock(`${DATA_PREFIX}*.${extension}`, RESOURCE_BLOCK);

const renderDeclarations = (): string =>
    [
        HEADER.join("\n"),
        ...sorted(ASSET_EXTENSIONS).map((extension) => resourceBlock(extension)),
        ...undeclaredByVite().map((extension) => declarationBlock(`*.${extension}`, ASSET_URL_BLOCK)),
        STYLE_SHEET_BLOCK.join("\n"),
    ].join("\n\n") + "\n";

const resolveAssetImport = (source: string): Promise<string | undefined | null> => {
    const plugin = gtkxResources();
    const resolve = (id: string): Promise<{ id: string }> => Promise.resolve({ id: `/abs/${id}` });

    return Promise.resolve((plugin.resolveId as ResolveIdHook).call({ resolve }, source));
};

const resolveEveryExtension = (specifier: (extension: string) => string): Promise<(string | undefined | null)[]> =>
    Promise.all(ASSET_EXTENSIONS.map((extension) => resolveAssetImport(specifier(extension))));

describe("@gtkx/cli/env asset declarations", () => {
    it("declares the bundled exports for exactly the specifiers the resources plugin rewrites", () => {
        expect(readFileSync(ENV_DECLARATIONS, "utf8")).toBe(renderDeclarations());
    });

    it("declares by hand only the asset extensions vite/client leaves undeclared", () => {
        expect(undeclaredByVite()).toEqual(UNDECLARED_BY_VITE);
    });
});

describe("gtkxResources (declared scope)", () => {
    it.each(SCOPE_CASES)("$title, for every declared asset extension", async ({ isRewritten, specifier }) => {
        const resolved = await resolveEveryExtension(specifier);
        const rewritten = resolved.filter((id) => typeof id === "string");
        expect(rewritten).toHaveLength(isRewritten ? ASSET_EXTENSIONS.length : 0);
    });
});
