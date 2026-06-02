import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type CodegenFingerprint, FINGERPRINT_FILENAME } from "./fingerprint.js";
import { type StoreOptions, writeStore } from "./store-fs.js";
import { transpileSource } from "./transpile.js";
import { type StoreSourceFile, typecheckGiStore } from "./typecheck-store.js";

/**
 * Absolute path to the hand-written augment overlay shipped with `@gtkx/codegen`.
 *
 * Resolves the same way whether codegen runs from `src/` (tsx) or `dist/`,
 * since `overlay/` sits at the package root next to both.
 */
const OVERLAY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "overlay");

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
    /** Transpilable raw module source, or `null` for augment-only namespaces (gl). */
    readonly rawSource: string | null;
};

/** Returns the augment `.ts` files for a namespace, or `[]` when it is pure pass-through. */
const overlayFiles = (directory: string): readonly string[] => {
    const dir = join(OVERLAY_ROOT, directory);
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((name) => name.endsWith(".ts") && name !== "index.ts");
};

const isAugmented = (directory: string): boolean => existsSync(join(OVERLAY_ROOT, directory, "index.ts"));

/**
 * Whether an augmented namespace's barrel re-exports a generated module (and so
 * may only be emitted when that namespace is generated), as opposed to a
 * standalone overlay like `gl` that has no GIR backing.
 */
const barrelNeedsGenerated = (directory: string): boolean =>
    readFileSync(join(OVERLAY_ROOT, directory, "index.ts"), "utf8").includes("../generated/");

/**
 * Retargets a barrel-template specifier from its source layout (under
 * `overlay/<ns>/`) to its emitted layout (under `gi/<ns>/`): the namespace's
 * own generated module becomes a sibling, augment files move under `augment/`,
 * and relative runtime modules collapse to the `@gtkx/ffi` barrel. The
 * `@gtkx/native` specifier passes through so low-level primitives resolve
 * straight to the native package.
 */
const retargetBarrelSpecifier = (spec: string, directory: string): string => {
    const generated = spec.match(/^\.\.\/generated\/[a-z0-9]+\/([a-z0-9]+)\.js$/);
    if (generated) return `./${generated[1]}.js`;
    if (spec.startsWith("../")) return "@gtkx/ffi";
    const sibling = spec.match(/^\.\/([a-z0-9-]+)\.js$/);
    if (sibling) {
        return existsSync(join(OVERLAY_ROOT, directory, `${sibling[1]}.ts`))
            ? `./augment/${sibling[1]}.js`
            : "@gtkx/ffi";
    }
    return spec;
};

const barrelSource = (directory: string): string => {
    if (!isAugmented(directory)) {
        return `export * from "./${directory}.js";\n`;
    }
    const template = readFileSync(join(OVERLAY_ROOT, directory, "index.ts"), "utf8");
    return template.replace(/"([^"]+)"/g, (_match, spec) => `"${retargetBarrelSpecifier(spec, directory)}"`);
};

type CollectedFile = {
    readonly stem: string;
    readonly fileName: string;
    readonly source: string;
    readonly overlay: boolean;
};

/**
 * Gathers the per-namespace generated module, augment overlay, and barrel
 * sources into a flat file list, building the package `exports` map alongside.
 */
const collectStoreSources = (
    directories: ReadonlySet<string>,
    standaloneSet: ReadonlySet<string>,
    rawByDirectory: ReadonlyMap<string, string | null>,
): { collected: CollectedFile[]; exportsMap: Record<string, unknown> } => {
    const exportsMap: Record<string, unknown> = { "./package.json": "./package.json" };
    const collected: CollectedFile[] = [];
    for (const directory of directories) {
        const rawSource = standaloneSet.has(directory) ? null : (rawByDirectory.get(directory) ?? null);
        if (rawSource !== null) {
            collected.push({
                stem: `${directory}/${directory}`,
                fileName: `${directory}/${directory}.ts`,
                source: rawSource,
                overlay: false,
            });
            exportsMap[`./${directory}/${directory}.js`] = {
                types: `./${directory}/${directory}.d.ts`,
                default: `./${directory}/${directory}.js`,
            };
        }
        for (const file of overlayFiles(directory)) {
            collected.push({
                stem: `${directory}/augment/${file.slice(0, -".ts".length)}`,
                fileName: `${directory}/augment/${file}`,
                source: readFileSync(join(OVERLAY_ROOT, directory, file), "utf8"),
                overlay: true,
            });
        }
        collected.push({
            stem: `${directory}/index`,
            fileName: `${directory}/index.ts`,
            source: barrelSource(directory),
            overlay: false,
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
 * Writes every namespace's raw generated module, its augment overlay, and its
 * barrel into a temporary store, emits the `package.json` and gi's own
 * `node_modules/@gtkx/{ffi,gi}` symlinks — the self-referential `@gtkx/gi` link
 * lets augment modules resolve sibling namespaces without relying on the
 * project's top-level alias — swaps it into place, and points the visible
 * `node_modules/@gtkx/gi` alias at it.
 *
 * @param options - Resolved store/link/dependency paths
 * @param namespaces - Per-namespace raw module inputs
 * @param fingerprint - Staleness sentinel written into the store, when provided
 */
export const writeGiStore = (
    options: GiStoreOptions,
    namespaces: readonly GiNamespaceInput[],
    fingerprint?: CodegenFingerprint,
): void => {
    const standaloneOverlays = readdirSync(OVERLAY_ROOT).filter(
        (name) => isAugmented(name) && !barrelNeedsGenerated(name),
    );
    const standaloneSet = new Set(standaloneOverlays);
    const directories = new Set<string>([...namespaces.map((n) => n.directory), ...standaloneOverlays]);
    const rawByDirectory = new Map(namespaces.map((n) => [n.directory, n.rawSource]));

    const { collected, exportsMap } = collectStoreSources(directories, standaloneSet, rawByDirectory);

    writeStore({
        storeDir: options.storeDir,
        linkDir: options.linkDir,
        files: collected.map((file) => ({ stem: file.stem, fileName: file.fileName, source: file.source })),
        manifest: {
            name: "@gtkx/gi",
            type: "module",
            version: options.version,
            sideEffects: true,
            exports: exportsMap,
        },
        rawFiles:
            fingerprint === undefined
                ? []
                : [{ relativePath: FINGERPRINT_FILENAME, content: `${JSON.stringify(fingerprint, null, 2)}\n` }],
        symlinks: [
            { segments: ["node_modules", "@gtkx", "ffi"], target: options.realFfiDir },
            { segments: ["node_modules", "@gtkx", "native"], target: options.realNativeDir },
            { segments: ["node_modules", "@gtkx", "gi"], target: "self" },
        ],
        validate: (tmp) => {
            const sources: StoreSourceFile[] = collected.map((file) =>
                file.overlay
                    ? { path: join(tmp, file.fileName), source: file.source, overlay: true }
                    : {
                          path: join(tmp, `${file.stem}.d.ts`),
                          source: transpileSource(file.fileName, file.source).dts,
                          overlay: false,
                      },
            );
            typecheckGiStore(tmp, sources, {
                ffiEntry: join(options.realFfiDir, "src", "index.ts"),
                nativeEntry: join(options.realNativeDir, "dist", "index.d.ts"),
            });
        },
    });
};
