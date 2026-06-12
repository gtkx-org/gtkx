import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { compileSchemas } from "../gsettings/compile.js";

const SCHEMA_SUFFIX = ".gschema.xml";
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "out-tsc", "build-dir"]);

const collectSchemaFiles = (dir: string, out: string[]): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIPPED_DIRECTORIES.has(entry.name)) collectSchemaFiles(path, out);
            continue;
        }
        if (entry.isFile() && entry.name.endsWith(SCHEMA_SUFFIX)) out.push(path);
    }
};

/**
 * Prepares the dev runner's GSettings environment before GTK loads.
 *
 * GLib snapshots its default schema source on first use, and the `@gtkx/gi`
 * side-effect imports initialize GTK ahead of application code — so a schema
 * compiled lazily when Vite first transforms a `.gschema.xml` import becomes
 * visible too late for `Gio.Settings` lookups. This scans the project for
 * schema files, compiles them into a temporary directory, and exports that
 * directory through `GSETTINGS_SCHEMA_DIR` (and `GTKX_DEV_SCHEMA_DIR`, which
 * the gsettings Vite plugin reuses for hot recompiles) while the runner
 * process is still GTK-free.
 *
 * @param root - The project root to scan for `.gschema.xml` files
 * @returns The compiled schema directory, or `null` when the project has no schemas
 */
export const prepareDevSchemaEnv = (root: string): string | null => {
    const schemaFiles: string[] = [];
    collectSchemaFiles(root, schemaFiles);
    if (schemaFiles.length === 0) return null;

    const dir = mkdtempSync(join(tmpdir(), "gtkx-dev-schemas-"));
    for (const file of schemaFiles) {
        copyFileSync(file, join(dir, basename(file)));
    }
    compileSchemas(dir);

    process.env.GTKX_DEV_SCHEMA_DIR = dir;
    const existing = process.env.GSETTINGS_SCHEMA_DIR;
    process.env.GSETTINGS_SCHEMA_DIR = existing ? `${dir}:${existing}` : dir;
    process.once("exit", () => rmSync(dir, { recursive: true, force: true, maxRetries: 5 }));

    return dir;
};
