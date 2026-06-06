/**
 * dependency-cruiser configuration.
 *
 * Enforces architectural boundaries between workspace packages that cannot be
 * expressed through package.json dependencies alone.
 *
 * Rule summary:
 *   1. `@gtkx/native` is the low-level transport layer. `@gtkx/ffi` is its
 *      primary consumer; `@gtkx/react` may also import it to bracket reconciler
 *      commits with `freeze`/`unfreeze`. `@gtkx/codegen` may reference it too:
 *      the generator logic via `import type { ... }` so it can emit binding
 *      signatures without dragging the native module into its runtime graph,
 *      and the augment overlay with runtime imports, since it is hand-written
 *      `@gtkx/gi` code that reaches the native transport layer directly.
 *   2. `@gtkx/mcp` is near-leaf: it may only depend on `@gtkx/utils` (which
 *      is itself a true leaf — no `@gtkx/*` deps). Any other `@gtkx/*`
 *      import would couple the MCP server to GTK runtime concerns.
 *   3. `@gtkx/utils` is the runtime-utilities leaf: it must not depend on
 *      any other `@gtkx/*` workspace package so every other package can
 *      pull it in safely.
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
                "Only @gtkx/ffi and @gtkx/react may import it — react brackets reconciler " +
                "commits with native's freeze/unfreeze. @gtkx/codegen is permitted type-only " +
                "imports (handled by the codegen-native-type-only rule).",
            from: { path: "^packages/(?!(ffi|codegen|native|react)/)" },
            to: { path: "^(packages/native/|@gtkx/native(/|$))" },
        },
        {
            name: "codegen-native-type-only",
            severity: "error",
            comment:
                "@gtkx/codegen's generator logic may reference @gtkx/native, but only with " +
                "`import type`. A runtime import would couple the code generator to the native " +
                "module. The augment overlay under overlay/ is exempt: it is hand-written " +
                "@gtkx/gi runtime code that reaches @gtkx/native directly for low-level transport.",
            from: { path: "^packages/codegen/(?!overlay/)" },
            to: {
                path: "^(packages/native/|@gtkx/native(/|$))",
                dependencyTypesNot: ["type-only"],
            },
        },
        {
            name: "mcp-only-utils-workspace-deps",
            severity: "error",
            comment:
                "@gtkx/mcp is near-leaf: it may import only @gtkx/utils. Any other " +
                "@gtkx/* workspace dep would couple the MCP server to GTK runtime concerns.",
            from: { path: "^packages/mcp/" },
            to: { path: "^(packages/(?!(mcp|utils)/)|@gtkx/(?!(mcp|utils)(/|$)))" },
        },
        {
            name: "utils-no-workspace-deps",
            severity: "error",
            comment:
                "@gtkx/utils is the runtime-utilities leaf. Any other @gtkx/* dependency " +
                "would block other packages from pulling it in safely.",
            from: { path: "^packages/utils/" },
            to: { path: "^(packages/(?!utils/)|@gtkx/(?!utils(/|$)))" },
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
