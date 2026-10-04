import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, "versions.json"), "utf8"));
const worktreeVersions = manifest.versions.filter((version) => version.reference.source === "worktree");

if (worktreeVersions.length !== 1) {
    throw new Error(
        `versions.json must declare exactly one version built from the working tree, found ${worktreeVersions.length}.`,
    );
}

const [worktreeVersion] = worktreeVersions;
const referenceOut = join(worktreeVersion.prefix.replace(/^\//, ""), "reference");
const referenceLink = `${worktreeVersion.prefix}/reference`;
const publicModuleNames = {
    "@gtkx/animated": ["index"],
    "@gtkx/cairo": ["index"],
    "@gtkx/cli": ["env", "vitest-plugin"],
    "@gtkx/codegen": ["index"],
    "@gtkx/components": ["index"],
    "@gtkx/config": ["index", "vite-plugin"],
    "@gtkx/css": ["index"],
    "@gtkx/forms": ["index"],
    "@gtkx/gl": ["index"],
    "@gtkx/i18n": ["index"],
    "@gtkx/navigation": ["index"],
    "@gtkx/react": ["index", "config"],
    "@gtkx/runtime": ["index"],
    "@gtkx/storybook": ["index", "config", "explorer"],
    "@gtkx/testing": ["index"],
    "@gtkx/vitest": ["index"],
};

export default {
    $schema: "https://typedoc.org/schema.json",
    name: "API Reference",
    plugin: [
        "typedoc-plugin-markdown",
        "typedoc-plugin-zod",
        "typedoc-vitepress-theme",
        "./typedoc-route-safe-router.mjs",
        "./typedoc-source-docs.mjs",
    ],
    router: "route-safe",
    publicModuleNames,
    entryPointStrategy: "packages",
    entryPoints: Object.keys(publicModuleNames).map((name) => `../packages/${name.replace("@gtkx/", "")}`),
    packageOptions: {
        entryPoints: ["./src/index.ts"],
        tsconfig: "./tsconfig.lib.json",
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
    out: referenceOut,
    docsRoot: ".",
    readme: "./.vitepress/reference-intro.md",
    mergeReadme: true,
    cleanOutputDir: true,
    githubPages: false,
    externalSymbolLinkMappings: {
        "@gtkx/testing": {
            tab: `${referenceLink}/@gtkx/testing/type-aliases/UserEvent#tab`,
            type: `${referenceLink}/@gtkx/testing/type-aliases/UserEvent#type`,
        },
    },
};
