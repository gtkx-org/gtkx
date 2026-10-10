import type { RetainedStagingDir } from "../internal/staging-dir.js";
import { prependSchemaDir, stageAndCompileProjectSchemas } from "../settings/schema.js";

const prepareDevSchemaDir = (root: string, staging: RetainedStagingDir): string | null => {
    const dir = stageAndCompileProjectSchemas(root, staging);

    if (dir === null) {
        return null;
    }

    process.env.GSETTINGS_SCHEMA_DIR = prependSchemaDir(dir, process.env.GSETTINGS_SCHEMA_DIR);

    return dir;
};

export { prepareDevSchemaDir };
