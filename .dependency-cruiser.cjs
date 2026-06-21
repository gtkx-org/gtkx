module.exports = {
    forbidden: [
        {
            name: "no-circular",
            severity: "error",
            comment:
                "Modules must not depend on each other directly or transitively. " +
                "Circular dependencies cause unpredictable load order, break tree-shaking, " +
                "and usually indicate a missing boundary in the design.",
            from: {},
            to: { circular: true },
        },
        {
            name: "no-orphans",
            severity: "error",
            comment:
                "Modules should be reachable from a package entry point. An orphan is usually " +
                "dead code left behind after a refactor: delete it or wire it in.",
            from: {
                orphan: true,
                pathNot: [
                    "\\.d\\.[cm]?ts$",
                    "tsconfig\\.[a-z]+\\.json$",
                    "tsconfig\\.json$",
                    "\\.(cjs|mjs|js)$",
                    "vitest\\.config\\.ts$",
                ],
            },
            to: {},
        },
        {
            name: "not-to-dev-dep",
            severity: "error",
            comment:
                "Shipped code must not import a devDependency. Either move the dependency to " +
                "'dependencies', or move the importing module into the test surface.",
            from: { pathNot: ["(^|/)tests?/", "\\.(spec|test)\\.[tj]sx?$"] },
            to: {
                dependencyTypes: ["npm-dev"],
                dependencyTypesNot: ["type-only"],
            },
        },
        {
            name: "utils-is-a-leaf",
            severity: "error",
            comment:
                "@gtkx/utils is the dependency-free leaf of the monorepo. It must not import any " +
                "other @gtkx package; other packages depend on it, never the other way around.",
            from: { path: "^packages/utils/" },
            to: { path: "^packages/(?!utils/)[^/]+/" },
        },
    ],
    options: {
        doNotFollow: { path: "node_modules" },
        exclude: {
            path: [
                "node_modules/(?!\\.gtkx/)",
                "packages/[^/]+/dist/",
                "packages/[^/]+/out-tsc/",
                "packages/[^/]+/coverage/",
                "packages/native/(target|npm)/",
                "packages/codegen/src/templates/",
            ],
        },
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
