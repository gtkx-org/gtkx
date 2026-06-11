import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type CodegenFingerprint, FINGERPRINT_FILENAME } from "./fingerprint.js";
import { type StoreOptions, writeStore } from "./store-fs.js";

/**
 * Absolute path to the hand-written override templates shipped with
 * `@gtkx/codegen`.
 *
 * Templates are raw `.ts` assets authored against the EMITTED store layout
 * (`./<ns>.js` for the generated sibling, `./overrides/<name>.js` for sibling
 * templates, `@gtkx/ffi` / `@gtkx/ffi/cairo` for the runtime); they are
 * embedded as text, never compiled as part of the codegen package itself.
 * The path resolves the same way whether codegen runs from `src/` (tsx) or
 * `dist/`, since `src/templates/` ships with the package next to `dist/`.
 */
const TEMPLATE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src", "templates");

/**
 * Options for assembling the injected `@gtkx/gi` package.
 */
export type GiStoreOptions = StoreOptions & {
    /** Real (symlink-resolved) directory of the installed `@gtkx/ffi`. */
    readonly realFfiDir: string;
    /** Real (symlink-resolved) directory of the installed `@gtkx/native`. */
    readonly realNativeDir: string;
};

/** Per-namespace inputs the store assembler turns into gi modules. */
export type GiNamespaceInput = {
    /** Lowercased namespace directory name (e.g. `"gtk"`). */
    readonly directory: string;
    /** Transpilable raw module source. */
    readonly rawSource: string;
};

/** Returns the override template `.ts` files for a namespace, or `[]` when it has none. */
const templateFiles = (directory: string): readonly string[] => {
    const dir = join(TEMPLATE_ROOT, directory);
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((name) => name.endsWith(".ts") && name !== "index.ts");
};

/**
 * The namespace's barrel source: the hand-written template barrel when the
 * namespace has one, else a plain re-export of the generated module.
 */
const barrelSource = (directory: string): string => {
    const template = join(TEMPLATE_ROOT, directory, "index.ts");
    if (!existsSync(template)) {
        return `export * from "./${directory}.js";\n`;
    }
    return readFileSync(template, "utf8");
};

type CollectedFile = {
    readonly stem: string;
    readonly fileName: string;
    readonly source: string;
};

/**
 * Gathers the per-namespace generated module, override templates, and barrel
 * sources into a flat file list, building the package `exports` map alongside.
 */
const collectStoreSources = (
    namespaces: readonly GiNamespaceInput[],
): { collected: CollectedFile[]; exportsMap: Record<string, unknown> } => {
    const exportsMap: Record<string, unknown> = { "./package.json": "./package.json" };
    const collected: CollectedFile[] = [];
    for (const { directory, rawSource } of namespaces) {
        collected.push({
            stem: `${directory}/${directory}`,
            fileName: `${directory}/${directory}.ts`,
            source: rawSource,
        });
        exportsMap[`./${directory}/${directory}.js`] = {
            types: `./${directory}/${directory}.d.ts`,
            default: `./${directory}/${directory}.js`,
        };
        for (const file of templateFiles(directory)) {
            collected.push({
                stem: `${directory}/overrides/${file.slice(0, -".ts".length)}`,
                fileName: `${directory}/overrides/${file}`,
                source: readFileSync(join(TEMPLATE_ROOT, directory, file), "utf8"),
            });
        }
        collected.push({
            stem: `${directory}/index`,
            fileName: `${directory}/index.ts`,
            source: barrelSource(directory),
        });
        exportsMap[`./${directory}`] = {
            types: `./${directory}/index.d.ts`,
            default: `./${directory}/index.js`,
        };
    }
    return { collected, exportsMap };
};

/**
 * Assembles the self-contained injected `@gtkx/gi` package.
 *
 * Writes every namespace's raw generated module, its override templates, and
 * its barrel into a temporary store, emits the `package.json` and gi's own
 * `node_modules/@gtkx/{ffi,gi}` symlinks — the self-referential `@gtkx/gi`
 * link lets override modules resolve sibling namespaces without relying on
 * the project's top-level alias — swaps it into place, and points the visible
 * `node_modules/@gtkx/gi` alias at it.
 *
 * @param options - Resolved store/link/dependency paths
 * @param namespaces - Per-namespace raw module inputs
 * @param fingerprint - Staleness sentinel written into the store
 */
export const writeGiStore = (
    options: GiStoreOptions,
    namespaces: readonly GiNamespaceInput[],
    fingerprint: CodegenFingerprint,
): void => {
    const { collected, exportsMap } = collectStoreSources(namespaces);

    writeStore({
        storeDir: options.storeDir,
        linkDir: options.linkDir,
        files: collected,
        manifest: {
            name: "@gtkx/gi",
            type: "module",
            version: options.version,
            sideEffects: true,
            exports: exportsMap,
        },
        rawFiles: [{ relativePath: FINGERPRINT_FILENAME, content: `${JSON.stringify(fingerprint, null, 2)}\n` }],
        symlinks: [
            { segments: ["node_modules", "@gtkx", "ffi"], target: options.realFfiDir },
            { segments: ["node_modules", "@gtkx", "native"], target: options.realNativeDir },
            { segments: ["node_modules", "@gtkx", "gi"], target: "self" },
        ],
    });
};
