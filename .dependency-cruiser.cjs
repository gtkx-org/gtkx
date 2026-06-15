/** @type {import('dependency-cruiser').IConfiguration} */
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
