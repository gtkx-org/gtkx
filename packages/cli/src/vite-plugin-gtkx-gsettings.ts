import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { Plugin } from "vite";

const SCHEMA_RE = /\.gschema\.xml$/;
const SCHEMA_ID_RE = /<schema\s+id="([^"]+)"/g;
const VIRTUAL_PREFIX = "\0gtkx-gsettings:";
const VIRTUAL_INIT = "\0gtkx-gsettings-init";

/**
 * Vite plugin that compiles GSettings schemas when imported.
 *
 * Intercepts imports of `.gschema.xml` files. The import's default export
 * is the schema ID extracted from the XML, so downstream code can use it
 * directly with `useSetting`. When the file contains multiple `<schema>`
 * elements, each ID is also available as a named export (with dots
 * replaced by underscores).
 *
 * **Dev mode:** Copies the schema to a temporary directory, runs
 * `glib-compile-schemas`, and sets `GSETTINGS_SCHEMA_DIR` so
 * `Gio.Settings` can find the compiled result. Schema file changes
 * trigger recompilation via HMR.
 *
 * **Build mode:** All imported schemas are compiled together at build time
 * into a single `gschemas.compiled` asset emitted next to the bundle. At
 * runtime a shared init module sets `GSETTINGS_SCHEMA_DIR` to the
 * bundle's directory once, regardless of how many schemas are imported.
 *
 * @example
 * ```ts
 * import schemaId from "./com.example.myapp.gschema.xml";
 * const [value, setValue] = useSetting(schemaId, "my-key", "string");
 * ```
 */
export function gtkxGSettings(): Plugin {
    let schemaDir: string | null = null;
    let isBuild = false;
    const trackedSchemas = new Map<string, string>();
    const buildSchemas = new Map<string, string>();

    const ensureSchemaDir = (): string => {
        if (!schemaDir) {
            schemaDir = mkdtempSync(join(tmpdir(), "gtkx-schemas-"));
        }
        return schemaDir;
    };

    const compile = (): void => {
        if (!schemaDir) return;
        execFileSync("glib-compile-schemas", [schemaDir]);

        const existing = process.env.GSETTINGS_SCHEMA_DIR;
        process.env.GSETTINGS_SCHEMA_DIR = existing ? `${schemaDir}:${existing}` : schemaDir;
    };

    return {
        name: "gtkx:gsettings",
        enforce: "pre",

        configResolved(config) {
            isBuild = config.command === "build";
        },

        async resolveId(source, importer, options) {
            if (source === VIRTUAL_INIT) return VIRTUAL_INIT;
            if (!SCHEMA_RE.test(source)) return;

            const resolved = await this.resolve(source, importer, {
                ...options,
                skipSelf: true,
            });
            if (!resolved || resolved.external) return;

            return VIRTUAL_PREFIX + resolved.id;
        },

        load(id) {
            if (id === VIRTUAL_INIT) {
                return [
                    `import { dirname } from "node:path";`,
                    `import { fileURLToPath } from "node:url";`,
                    ``,
                    `const bundleDir = dirname(fileURLToPath(import.meta.url));`,
                    `const existing = process.env.GSETTINGS_SCHEMA_DIR;`,
                    `process.env.GSETTINGS_SCHEMA_DIR = existing ? bundleDir + ":" + existing : bundleDir;`,
                ].join("\n");
            }

            if (!id.startsWith(VIRTUAL_PREFIX)) return;

            const filePath = id.slice(VIRTUAL_PREFIX.length);
            const xml = readFileSync(filePath, "utf-8");
            const fileName = basename(filePath);

            if (isBuild) {
                buildSchemas.set(filePath, fileName);
                console.log(`[gtkx] Queued GSettings schema: ${fileName}`);
            } else {
                trackedSchemas.set(filePath, id);

                const dir = ensureSchemaDir();
                copyFileSync(filePath, join(dir, fileName));
                compile();

                console.log(`[gtkx] Compiled GSettings schema: ${fileName}`);
            }

            const schemaIds: string[] = [];
            for (const match of xml.matchAll(SCHEMA_ID_RE)) {
                schemaIds.push(match[1] as string);
            }

            if (schemaIds.length === 0) {
                this.error(`No <schema id="..."> found in ${fileName}`);
            }

            const exports = [`export default ${JSON.stringify(schemaIds[0])};`];
            for (const schemaId of schemaIds) {
                const exportName = schemaId.replaceAll(".", "_");
                exports.push(`export const ${exportName} = ${JSON.stringify(schemaId)};`);
            }

            if (isBuild) {
                return [`import ${JSON.stringify(VIRTUAL_INIT)};`, "", ...exports].join("\n");
            }

            return exports.join("\n");
        },

        buildEnd() {
            if (!isBuild || buildSchemas.size === 0) return;

            const dir = mkdtempSync(join(tmpdir(), "gtkx-schemas-build-"));
            for (const [filePath, fileName] of buildSchemas) {
                copyFileSync(filePath, join(dir, fileName));
            }
            execFileSync("glib-compile-schemas", [dir]);

            const compiled = readFileSync(join(dir, "gschemas.compiled"));
            this.emitFile({
                type: "asset",
                fileName: "gschemas.compiled",
                source: compiled,
            });

            console.log(`[gtkx] Compiled ${buildSchemas.size} GSettings schema(s)`);
        },

        handleHotUpdate({ file, server }) {
            const virtualId = trackedSchemas.get(file);
            if (!virtualId) return;

            const dir = ensureSchemaDir();
            copyFileSync(file, join(dir, basename(file)));
            compile();

            console.log(`[gtkx] Recompiled GSettings schema: ${basename(file)}`);

            const mod = server.moduleGraph.getModuleById(virtualId);
            if (mod) {
                server.moduleGraph.invalidateModule(mod);
                return [mod];
            }
        },
    };
}
