import { prependSchemaDir, stageAndCompileProjectSchemas } from "../settings/schema.js";

const prepareDevSchemaDir = (root: string): string | null => {
    const dir = stageAndCompileProjectSchemas(root);

    if (dir === null) {
        return null;
    }

    process.env.GTKX_DEV_SCHEMA_DIR = dir;
    process.env.GSETTINGS_SCHEMA_DIR = prependSchemaDir(dir, process.env.GSETTINGS_SCHEMA_DIR);

    return dir;
};

export { prepareDevSchemaDir };
