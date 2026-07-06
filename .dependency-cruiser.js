import { fileURLToPath } from "node:url";

const defaultStrictRulesPath = fileURLToPath(
    new URL("node_modules/dependency-cruiser/configs/recommended-strict.cjs", import.meta.url),
);

export default {
    extends: defaultStrictRulesPath,
    options: {
        includeOnly: "packages/[^/]+/src/",
        tsConfig: { fileName: "tsconfig.base.json" },
        tsPreCompilationDeps: true,
        enhancedResolveOptions: {
            exportsFields: ["exports"],
            conditionNames: ["source", "import", "require", "default"],
            mainFields: ["source", "main", "types"],
        },
        moduleSystems: ["es6", "cjs"],
    },
};
