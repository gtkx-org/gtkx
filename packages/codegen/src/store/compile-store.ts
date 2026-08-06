import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileProject, type SourceModule } from "../compile.js";

type CompileStoreParams = {
    storeDir: string;
    files: SourceModule[];
    packageName: string;
    requiresEnvReference?: boolean;
};

const EMIT_OPTIONS = {
    declaration: true,
    removeComments: false,
    sourceMap: false,
    declarationMap: false,
    rootDir: ".",
    outDir: ".",
};

const ENV_REFERENCE_FILE = "__gtkx-env__.d.ts";

const writeEnvReference = (storeDir: string): (() => void) => {
    writeFileSync(join(storeDir, ENV_REFERENCE_FILE), "/// <reference types=\"@gtkx/react/env\" />\n");

    return () => {
        rmSync(join(storeDir, ENV_REFERENCE_FILE), { force: true });
    };
};

const compileStore = (params: CompileStoreParams): void => {
    const fileNames = params.files.map((file) => file.fileName);

    const removeEnvReference = params.requiresEnvReference === true
        ? writeEnvReference(params.storeDir)
        : (): void => undefined;

    try {
        compileProject({
            projectDir: params.storeDir,
            fileNames: params.requiresEnvReference === true ? [ENV_REFERENCE_FILE, ...fileNames] : fileNames,
            compilerOptions: EMIT_OPTIONS,
            label: `the generated ${params.packageName} store`,
        });
    } finally {
        removeEnvReference();
    }

    for (const file of params.files) {
        rmSync(join(params.storeDir, file.fileName), { force: true });
    }
};

export { compileStore };
