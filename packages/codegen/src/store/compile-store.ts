import { rmSync } from "node:fs";
import { join } from "node:path";
import { emitModules, type SourceModule } from "../compile.js";

type CompileStoreParams = {
    storeDir: string;
    files: SourceModule[];
    packageName: string;
};

const compileStore = (params: CompileStoreParams): void => {
    emitModules({
        projectDir: params.storeDir,
        files: params.files,
        label: `the generated ${params.packageName} store`,
    });

    for (const file of params.files) {
        rmSync(join(params.storeDir, file.fileName), { force: true });
    }
};

export { compileStore };
