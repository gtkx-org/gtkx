import { discoverGirNamespaces, resolveGirPath, runCodegen } from "@gtkx/codegen";
import { BASE_COMPILER_OPTIONS, resolveCodegenInputs } from "@gtkx/codegen/internal";
import { realpathSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const modes = ["declarations", "sources"] as const;
const mode = modes.find((candidate) => candidate === process.argv[2]);

if (mode === undefined) {
    throw new Error(`Pass the generated files to typecheck: ${modes.join(" or ")}.`);
}

const packageDir = join(import.meta.dirname, "..");
const workspaceRoot = join(packageDir, "..", "..");
const outputDir = join(workspaceRoot, "build", "bindings-typecheck", mode);
const modulesDir = join(outputDir, "node_modules");
const girPath = resolveGirPath(undefined);
const { store } = resolveCodegenInputs(packageDir, {});

if (store.react === null) {
    throw new Error("Cannot resolve @gtkx/react from @gtkx/codegen; the JSX bindings cannot be generated.");
}

const shouldKeepSources = mode === "sources";
const gi = { storeDir: join(modulesDir, ".gtkx", "gi"), linkDir: join(modulesDir, "@gtkx", "gi") };
const jsx = { storeDir: join(modulesDir, ".gtkx", "jsx"), linkDir: join(modulesDir, "@gtkx", "jsx") };

await runCodegen({
    libraries: discoverGirNamespaces(girPath),
    girPath,
    gi: { ...gi, version: store.runtimeVersion, dependencies: store.giDependencies, shouldKeepSources },
    jsx: { ...jsx, version: store.react.version, dependencies: store.jsxDependencies, shouldKeepSources },
    isForced: true,
});

// TypeScript keeps a symlinked root file's path but resolves imports to real paths, so including the store
// through its link would load every imported module twice.
const storeFiles = (storeDir: string, pattern: string): string =>
    `./${relative(outputDir, realpathSync(storeDir))}/${pattern}`;

// @gtkx/react resolves @gtkx/gi from its own package directory, which reaches the workspace's store rather than
// this one, so its types would describe different classes than the bindings being checked.
const giPaths = (extension: string): Record<string, string[]> => ({
    "@gtkx/gi/*": [storeFiles(gi.storeDir, `*/index${extension}`)],
});

type ProjectBase = { extends?: string; compilerOptions: Record<string, unknown> };

const writeProject = (base: ProjectBase, include: string[]): void => {
    const tsconfig = {
        ...base,
        compilerOptions: { ...base.compilerOptions, noEmit: true, skipLibCheck: false },
        include,
    };

    writeFileSync(join(outputDir, `tsconfig.${mode}.json`), `${JSON.stringify(tsconfig, null, 4)}\n`);
};

if (mode === "declarations") {
    writeProject(
        {
            extends: relative(outputDir, join(workspaceRoot, "tsconfig.base.json")),
            compilerOptions: { composite: false, declarationMap: false, paths: giPaths(".d.ts") },
        },
        [storeFiles(gi.storeDir, "**/*.d.ts"), storeFiles(jsx.storeDir, "**/*.d.ts")],
    );
} else {
    writeProject({ compilerOptions: { ...BASE_COMPILER_OPTIONS, paths: giPaths(".ts") } }, [
        storeFiles(gi.storeDir, "**/*.ts"),
        storeFiles(jsx.storeDir, "**/*.ts"),
        storeFiles(jsx.storeDir, "**/*.tsx"),
    ]);
}
