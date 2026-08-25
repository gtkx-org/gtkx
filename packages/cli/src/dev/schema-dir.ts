import { resolveDataDir } from "../internal/data-dir.js";
import { prependSchemaDir, stageAndCompileProjectSchemas } from "../settings/schema.js";

const prepareDevSchemaDir = (root: string, isV2ResourceImports: boolean): string | null => {
    const dataDir = isV2ResourceImports ? null : resolveDataDir(root);
    const dir = stageAndCompileProjectSchemas(root, dataDir);

    if (dir === null) {
        return null;
    }

    process.env.GTKX_DEV_SCHEMA_DIR = dir;
    process.env.GSETTINGS_SCHEMA_DIR = prependSchemaDir(dir, process.env.GSETTINGS_SCHEMA_DIR);

    return dir;
};

export { prepareDevSchemaDir };
