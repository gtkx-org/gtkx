import { fileURLToPath } from "node:url";

const defaultStrictRulesPath = fileURLToPath(
    new URL("node_modules/dependency-cruiser/configs/recommended-strict.cjs", import.meta.url),
);

const ORPHAN_EXEMPT = [
    String.raw`(^|/)\.[^/]+\.(js|cjs|mjs|ts|json)$`,
    String.raw`\.d\.(c|m)?ts$`,
    String.raw`(^|/)tsconfig\.json$`,
    String.raw`(^|/)(?:babel|webpack)\.config\.(?:js|cjs|mjs|ts|json)$`,
    "(^|/)bin/",
    String.raw`\.(test|bench)\.(ts|tsx)$`,
    "(^|/)tests/.*(setup|fixtures)",
].join("|");

const EXCLUDED = [
    String.raw`node_modules/\.gtkx`,
    "/dist/",
    "/out-tsc/",
    "/coverage/",
    "packages/gl/src/generated",
    "examples/tutorial",
    String.raw`packages/native/index\.js`,
    "^virtual:",
].join("|");

export default {
    extends: defaultStrictRulesPath,
    forbidden: [
        {
            name: "no-orphans",
            comment:
                "An orphan module is dead code. Graph roots stay exempt: bin/ entry points node invokes " +
                "directly, test and bench files nothing imports, and the vitest setup and fixture modules " +
                "the runner loads by configuration.",
            severity: "error",
            from: { orphan: true, pathNot: ORPHAN_EXEMPT },
            to: {},
        },
    ],
    options: {
        exclude: {
            path: EXCLUDED,
        },
        parser: "swc",
        enhancedResolveOptions: {
            exportsFields: ["exports"],
            conditionNames: ["source", "import", "require", "default"],
            mainFields: ["source", "main", "types"],
        },
        moduleSystems: ["es6", "cjs"],
    },
};
