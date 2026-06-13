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
        {
            name: "native-only-from-ffi",
            severity: "error",
            comment:
                "@gtkx/native is the Rust napi-rs addon — the low-level FFI transport between " +
                "JavaScript and GTK. Only @gtkx/ffi (which wraps it) and @gtkx/react (which " +
                "calls its freeze()/unfreeze() to batch a reconciler commit before GTK repaints) " +
                "may import it at runtime. @gtkx/codegen is allowed type-only imports — see the " +
                "codegen-native-type-only rule.",
            from: { path: "^packages/(?!(ffi|codegen|native|react)/)" },
            to: { path: "^(packages/native/|@gtkx/native(/|$))" },
        },
        {
            name: "codegen-native-type-only",
            severity: "error",
            comment:
                "@gtkx/codegen may reference @gtkx/native only with `import type`. The generator " +
                "emits binding signatures that name native's types, but a runtime import would " +
                "pull the native addon into the generator process. At runtime the override " +
                "templates under src/templates reach native through @gtkx/ffi instead.",
            from: { path: "^packages/codegen/" },
            to: {
                path: "^(packages/native/|@gtkx/native(/|$))",
                dependencyTypesNot: ["type-only"],
            },
        },
        {
            name: "codegen-no-react",
            severity: "error",
            comment:
                "@gtkx/codegen must not import @gtkx/react. Data flows one way: codegen produces " +
                "the reconciler tables and ships them to react through the generated " +
                "@gtkx/jsx/metadata module. Importing react here would reverse that flow and load " +
                "the component runtime — which needs virtual:gtkx-config — inside the generator.",
            from: { path: "^packages/codegen/" },
            to: { path: "^packages/react/" },
        },
        {
            name: "react-no-jsx",
            severity: "error",
            comment:
                "@gtkx/react must not import the generated @gtkx/jsx modules, type-only included. " +
                "The dependency runs one way: react defines the base prop shapes and the generated " +
                "@gtkx/jsx Props interfaces extend them. This keeps react independent of any " +
                "specific GI namespace so it loads in any project.",
            from: { path: "^packages/react/" },
            to: { path: "(^|/)node_modules/\\.gtkx/jsx/" },
        },
        {
            name: "react-no-optional-gi",
            severity: "error",
            comment:
                "@gtkx/react must load in a project that has only GTK installed, so it may not " +
                "import the optional namespaces (Adwaita, GtkSource, WebKit, JavaScriptCore, Soup), " +
                "even type-only. Where it must handle their widgets it refers to them by GLib type " +
                "name — a string resolved at runtime, see gtype-predicates.ts. Richer " +
                "optional-namespace support lives in dedicated packages such as @gtkx/animate.",
            from: { path: "^packages/react/" },
            to: { path: "(^|/)node_modules/\\.gtkx/gi/(adw|gtksource|webkit|javascriptcore|soup)/" },
        },
        {
            name: "mcp-only-utils-workspace-deps",
            severity: "error",
            comment:
                "@gtkx/mcp may import only one workspace package, @gtkx/utils. It is a standalone " +
                "server that drives running GTKX apps over a socket; depending on any other " +
                "@gtkx/* package would pull the GTK runtime into the server process.",
            from: { path: "^packages/mcp/" },
            to: { path: "^(packages/(?!(mcp|utils)/)|@gtkx/(?!(mcp|utils)(/|$)))" },
        },
        {
            name: "utils-no-workspace-deps",
            severity: "error",
            comment:
                "@gtkx/utils must not depend on any other @gtkx/* package. Nearly every package " +
                "imports it, so a workspace dependency here would risk an import cycle.",
            from: { path: "^packages/utils/" },
            to: { path: "^(packages/(?!utils/)|@gtkx/(?!utils(/|$)))" },
        },
        {
            name: "config-no-workspace-deps",
            severity: "error",
            comment:
                "@gtkx/config must not depend on any other @gtkx/* package. The cli and the test " +
                "packages load it, and the cli also depends on @gtkx/vitest — which loads config " +
                "too — so a workspace dependency here would close a cycle through the toolchain.",
            from: { path: "^packages/config/" },
            to: { path: "^(packages/(?!config/)|@gtkx/(?!config(/|$)))" },
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
        tsConfig: { fileName: "tsconfig.json" },
        tsPreCompilationDeps: true,
        enhancedResolveOptions: {
            exportsFields: ["exports"],
            conditionNames: ["source", "import", "require", "default"],
            mainFields: ["source", "main", "types"],
        },
        moduleSystems: ["es6", "cjs"],
    },
};
