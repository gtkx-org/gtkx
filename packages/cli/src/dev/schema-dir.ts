import { prependSchemaDir, stageAndCompileProjectSchemas } from "../settings/schema.js";

const prepareDevSchemaDir = (root: string, dataDir: string | null): string | null => {
    const dir = stageAndCompileProjectSchemas(root, dataDir);

    if (dir === null) {
        return null;
    }

    process.env.GTKX_DEV_SCHEMA_DIR = dir;
    process.env.GSETTINGS_SCHEMA_DIR = prependSchemaDir(dir, process.env.GSETTINGS_SCHEMA_DIR);

    return dir;
};

export { prepareDevSchemaDir };
