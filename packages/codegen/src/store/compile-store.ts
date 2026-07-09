import { rmSync } from "node:fs";
import { join } from "node:path";
import { compileProject, type SourceModule } from "../compile.js";

export type CompileStoreParams = {
    storeDir: string;
    files: SourceModule[];
    packageName: string;
    exports: Record<string, unknown>;
};

const EMIT_OPTIONS = {
    declaration: true,
    removeComments: false,
    sourceMap: false,
    declarationMap: false,
    noEmitOnError: true,
    rootDir: ".",
    outDir: ".",
};

const selfPaths = (
    packageName: string,
    exportsMap: Record<string, unknown>,
    storeDir: string,
): Record<string, string[]> => {
    const paths: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(exportsMap)) {
        if (key === "./package.json" || typeof value !== "object" || value === null) continue;
        const target = (value as { default?: unknown }).default;
        if (typeof target !== "string") continue;
        const stem = target.replace(/^\.\//, "").replace(/\.js$/, "");
        paths[`${packageName}${key.slice(1)}`] = [join(storeDir, stem)];
    }
    return paths;
};

export const compileStore = (params: CompileStoreParams): void => {
    compileProject({
        projectDir: params.storeDir,
        fileNames: params.files.map((file) => file.fileName),
        compilerOptions: EMIT_OPTIONS,
        paths: selfPaths(params.packageName, params.exports, params.storeDir),
        label: `the generated ${params.packageName} store`,
    });
    for (const file of params.files) {
        rmSync(join(params.storeDir, file.fileName), { force: true });
    }
};
