import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { emitModules, type SourceModule } from "../compile.js";

type CompileStoreParams = {
    storeDir: string;
    files: SourceModule[];
    packageName: string;
    dependencies?: Record<string, string> | undefined;
};

const linkDependencies = (storeDir: string, dependencies: Record<string, string>): (() => void) => {
    const modules = join(storeDir, "node_modules");

    for (const [name, target] of Object.entries(dependencies)) {
        const link = join(modules, name);
        mkdirSync(dirname(link), { recursive: true });
        symlinkSync(relative(dirname(link), target), link, "dir");
    }

    return () => {
        rmSync(modules, { recursive: true, force: true });
    };
};

const compileStore = (params: CompileStoreParams): void => {
    const cleanup = linkDependencies(params.storeDir, params.dependencies ?? {});

    try {
        emitModules({
            projectDir: params.storeDir,
            files: params.files,
            label: `the generated ${params.packageName} store`,
        });
    } finally {
        cleanup();
    }

    for (const file of params.files) {
        rmSync(join(params.storeDir, file.fileName), { force: true });
    }
};

export { compileStore };
