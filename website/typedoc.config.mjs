import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const api = JSON.parse(readFileSync(join(root, "api.json"), "utf8"));
const packages = new Map();
const entryPointsByPackage = new Map();

const byName = (left, right) => left.localeCompare(right);

const splitSpecifier = (specifier) => {
    const segments = specifier.split("/");
    const name = specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];

    return { name, subpath: `.${specifier.slice(name.length)}` };
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const readTypedocEntryPoints = (dir) => {
    try {
        return readJson(join(dir, "typedoc.json")).entryPoints;
    } catch {
        return;
    }
};

for (const specifier of api.entrypoints) {
    const { name, subpath } = splitSpecifier(specifier);

    if (!packages.has(name)) {
        const dir = join(root, "packages", name.replace(/^@gtkx\//, ""));
        packages.set(name, { dir, manifest: readJson(join(dir, "package.json")) });
    }

    const { manifest } = packages.get(name);
    const condition = manifest.exports[subpath];
    const types = typeof condition === "string" ? condition : condition.types;
    entryPointsByPackage.set(name, [...(entryPointsByPackage.get(name) ?? []), types]);
}

for (const [name, entryPoints] of entryPointsByPackage) {
    const { dir } = packages.get(name);
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
    plugin: ["typedoc-plugin-markdown", "typedoc-vitepress-theme"],
    entryPointStrategy: "packages",
    entryPoints: packages.values().map((entry) => relative(here, entry.dir)).toArray(),
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
