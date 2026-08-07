import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEntrypoints } from "../packages/eslint/src/api-entrypoints.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const api = JSON.parse(readFileSync(join(root, "api.json"), "utf8"));
const packageDirs = new Map();
const entryPointsByPackage = new Map();
const publicModuleNames = {};

const byName = (left, right) => left.localeCompare(right);

const getPackageName = (specifier) =>
    packageDirs.keys().find((name) => specifier === name || specifier.startsWith(`${name}/`));

const readTypedocEntryPoints = (dir) => {
    try {
        return JSON.parse(readFileSync(join(dir, "typedoc.json"), "utf8")).entryPoints;
    } catch {
        return;
    }
};

for (const { dir, name, path } of resolveEntrypoints(root, api.entrypoints, "types")) {
    packageDirs.set(name, dir);
    entryPointsByPackage.set(name, [...(entryPointsByPackage.get(name) ?? []), path]);
}

for (const specifier of api.entrypoints) {
    const name = getPackageName(specifier);

    if (name !== undefined) {
        const subpath = specifier.slice(name.length + 1) || "index";
        publicModuleNames[name] = [...(publicModuleNames[name] ?? []), subpath];
    }
}

for (const [name, entryPoints] of entryPointsByPackage) {
    const dir = packageDirs.get(name);
    const expected = entryPoints.toSorted(byName);
    const actual = (readTypedocEntryPoints(dir) ?? ["./dist/index.d.ts"]).toSorted(byName);

    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        throw new Error(
            `${relative(root, join(dir, "typedoc.json"))} declares entryPoints ${JSON.stringify(actual)}, ` +
            `but api.json publishes ${JSON.stringify(expected)} from ${name}.`,
        );
    }
}

export default {
    $schema: "https://typedoc.org/schema.json",
    name: "API Reference",
    plugin: ["typedoc-plugin-markdown", "typedoc-vitepress-theme", "./typedoc-route-safe-router.mjs"],
    router: "route-safe",
    publicModuleNames,
    entryPointStrategy: "packages",
    entryPoints: packageDirs.values().map((dir) => relative(here, dir)).toArray(),
    packageOptions: {
        entryPoints: ["./dist/index.d.ts"],
        tsconfig: "../../website/tsconfig.typedoc.json",
        readme: "none",
    },
    treatWarningsAsErrors: true,
    validation: {
        notExported: true,
        invalidLink: true,
        rewrittenLink: true,
        notDocumented: true,
        unusedMergeModuleWith: true,
    },
    sanitizeComments: true,
    out: "reference",
    docsRoot: ".",
    readme: "./.vitepress/reference-intro.md",
    mergeReadme: true,
    cleanOutputDir: true,
    githubPages: false,
    externalSymbolLinkMappings: {
        "@gtkx/testing": {
            tab: "/reference/@gtkx/testing/type-aliases/UserEvent#tab",
            type: "/reference/@gtkx/testing/type-aliases/UserEvent#type",
        },
    },
};
