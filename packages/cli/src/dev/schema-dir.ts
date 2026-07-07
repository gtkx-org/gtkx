import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileSchemas } from "../gsettings/compile.js";
import { findSchemaFiles, prependSchemaDir, stageSchema } from "../gsettings/env.js";
import { removeTempDir } from "../internal/staging-dir.js";

export const prepareDevSchemaDir = (root: string, dataDir: string | null): string | null => {
    if (dataDir === null) return null;
    const schemaFiles = findSchemaFiles(join(root, dataDir));
    if (schemaFiles.length === 0) return null;

    const dir = mkdtempSync(join(tmpdir(), "gtkx-dev-schemas-"));
    for (const file of schemaFiles) {
        stageSchema(dir, file);
    }
    compileSchemas(dir);

    process.env.GTKX_DEV_SCHEMA_DIR = dir;
    process.env.GSETTINGS_SCHEMA_DIR = prependSchemaDir(dir, process.env.GSETTINGS_SCHEMA_DIR);
    process.once("exit", () => removeTempDir(dir));

    return dir;
};
