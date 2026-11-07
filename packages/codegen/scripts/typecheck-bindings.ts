import { discoverGirNamespaces, resolveGirPath, runCodegen } from "@gtkx/codegen";
import { resolveCodegenInputs } from "@gtkx/codegen/internal";
import { realpathSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const packageDir = join(import.meta.dirname, "..");
const workspaceRoot = join(packageDir, "..", "..");
const outputDir = join(workspaceRoot, "build", "bindings-typecheck");
const modulesDir = join(outputDir, "node_modules");
const girPath = resolveGirPath(undefined);
const { store } = resolveCodegenInputs(packageDir, {});

if (store.react === null) {
    throw new Error("Cannot resolve @gtkx/react from @gtkx/codegen; the JSX bindings cannot be generated.");
}

const gi = { storeDir: join(modulesDir, ".gtkx", "gi"), linkDir: join(modulesDir, "@gtkx", "gi") };
const jsx = { storeDir: join(modulesDir, ".gtkx", "jsx"), linkDir: join(modulesDir, "@gtkx", "jsx") };

await runCodegen({
    libraries: discoverGirNamespaces(girPath),
    girPath,
    gi: { ...gi, version: store.runtimeVersion, dependencies: store.giDependencies },
    jsx: { ...jsx, version: store.react.version, dependencies: store.jsxDependencies },
    isForced: true,
});

// TypeScript keeps a symlinked root file's path but resolves imports to real paths, so including the store
// through its link would load every imported module twice.
const storeFiles = (storeDir: string, pattern: string): string =>
    `${relative(outputDir, realpathSync(storeDir))}/${pattern}`;

const writeProject = (name: string, include: string[]): void => {
    const tsconfig = {
        extends: relative(outputDir, join(workspaceRoot, "tsconfig.base.json")),
        compilerOptions: {
            composite: false,
            declarationMap: false,
            noEmit: true,
            skipLibCheck: false,
            paths: {},
        },
        include,
    };

    writeFileSync(join(outputDir, `tsconfig.${name}.json`), `${JSON.stringify(tsconfig, null, 4)}\n`);
};

writeProject("declarations", [storeFiles(gi.storeDir, "**/*.d.ts"), storeFiles(jsx.storeDir, "**/*.d.ts")]);
