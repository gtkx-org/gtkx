/**
 * dependency-cruiser configuration.
 *
 * Enforces architectural boundaries between workspace packages that cannot be
 * expressed through package.json dependencies alone.
 *
 * Rule summary:
 *   1. `@gtkx/native` is private to `@gtkx/ffi`. The only other package
 *      permitted to reference it is `@gtkx/codegen`, and only via
 *      `import type { ... }` so the generator can emit binding signatures
 *      without dragging the native module into its runtime graph.
 *   2. `@gtkx/mcp` is a leaf: it must not depend on any other `@gtkx/*`
 *      workspace package.
 *
 * The configuration is consumed via `pnpm depcruise` (see root package.json)
 * and runs as part of `pnpm lint:all`.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
    forbidden: [
        {
            name: "no-circular",
            severity: "error",
            comment:
                "Modules must not depend on each other directly or transitively. " +
                "Circular dependencies cause unpredictable load order, break tree-shaking, " +
                "and tend to point at a missing seam in the design.",
            from: {},
            to: { circular: true },
        },
        {
            name: "native-only-from-ffi",
            severity: "error",
            comment:
                "@gtkx/native is the low-level transport and GObject identity layer. " +
                "Only @gtkx/ffi may import it. @gtkx/codegen is permitted type-only " +
                "imports (handled by the codegen-native-type-only rule).",
            from: { path: "^packages/(?!(ffi|codegen|native)/)" },
            to: { path: "^(packages/native/|@gtkx/native(/|$))" },
        },
        {
            name: "codegen-native-type-only",
            severity: "error",
            comment:
                "@gtkx/codegen may reference @gtkx/native, but only with `import type`. " +
                "A runtime import would couple the code generator to the native module.",
            from: { path: "^packages/codegen/" },
            to: {
                path: "^(packages/native/|@gtkx/native(/|$))",
                dependencyTypesNot: ["type-only"],
            },
        },
        {
            name: "mcp-no-workspace-deps",
            severity: "error",
            comment:
                "@gtkx/mcp must remain a leaf package. Importing any other @gtkx/* " +
                "workspace package would couple the MCP server to GTK runtime concerns.",
            from: { path: "^packages/mcp/" },
            to: { path: "^(packages/(?!mcp/)|@gtkx/(?!mcp(/|$)))" },
        },
    ],
    options: {
        doNotFollow: { path: "node_modules" },
        exclude: {
            path: [
                "node_modules",
                "packages/[^/]+/dist/",
                "packages/[^/]+/out-tsc/",
                "packages/[^/]+/coverage/",
                "packages/[^/]+/src/generated/",
                "packages/native/(target|npm)/",
                "examples/",
                "website/",
            ],
        },
        tsConfig: { fileName: "tsconfig.json" },
        enhancedResolveOptions: {
            exportsFields: ["exports"],
            conditionNames: ["source", "import", "require", "default"],
            mainFields: ["source", "main", "types"],
        },
        moduleSystems: ["es6", "cjs"],
    },
};
