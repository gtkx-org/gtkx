import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resetDir, swapStore, symlinkRelative, tempStoreFor, writeFilePair, writePackageJson } from "./store-fs.js";

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
export type GiStoreOptions = {
    /** Absolute path to the hidden store directory (`node_modules/.gtkx/gi`). */
    readonly storeDir: string;
    /** Absolute path to the visible symlink (`node_modules/@gtkx/gi`). */
    readonly linkDir: string;
    /** Real (symlink-resolved) directory of the installed `@gtkx/ffi`. */
    readonly realFfiDir: string;
    /** Version string copied onto the emitted `@gtkx/gi` package. */
    readonly version: string;
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
 * and runtime modules that stay in `@gtkx/ffi` collapse to that barrel.
 */
const retargetBarrelSpecifier = (spec: string, directory: string): string => {
    const generated = spec.match(/^\.\.\/generated\/[a-z0-9]+\/([a-z0-9]+)\.js$/);
    if (generated) return `./${generated[1]}.js`;
    if (spec === "@gtkx/native") return "@gtkx/ffi";
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

/**
 * Assembles the self-contained injected `@gtkx/gi` package.
 *
 * Writes every namespace's raw generated module, its augment overlay, and its
 * barrel into a temporary store, emits the `package.json` and gi's own
 * `node_modules/@gtkx/ffi` symlink, atomically swaps it into place, and points
 * the visible `node_modules/@gtkx/gi` alias at it.
 *
 * @param options - Resolved store/link/dependency paths
 * @param namespaces - Per-namespace raw module inputs
 */
export const writeGiStore = (options: GiStoreOptions, namespaces: readonly GiNamespaceInput[]): void => {
    const standaloneOverlays = readdirSync(OVERLAY_ROOT).filter(
        (name) => isAugmented(name) && !barrelNeedsGenerated(name),
    );
    const directories = new Set<string>([...namespaces.map((n) => n.directory), ...standaloneOverlays]);
    const rawByDirectory = new Map(namespaces.map((n) => [n.directory, n.rawSource]));

    const tmp = tempStoreFor(options.storeDir);
    resetDir(tmp);

    const exportsMap: Record<string, unknown> = { "./package.json": "./package.json" };

    for (const directory of directories) {
        const rawSource = rawByDirectory.get(directory) ?? null;
        if (rawSource !== null) {
            writeFilePair(tmp, `${directory}/${directory}`, `${directory}/${directory}.ts`, rawSource);
            exportsMap[`./${directory}/${directory}.js`] = {
                types: `./${directory}/${directory}.d.ts`,
                default: `./${directory}/${directory}.js`,
            };
        }
        for (const file of overlayFiles(directory)) {
            const fileStem = file.slice(0, -".ts".length);
            const source = readFileSync(join(OVERLAY_ROOT, directory, file), "utf8");
            writeFilePair(tmp, `${directory}/augment/${fileStem}`, `${directory}/augment/${file}`, source);
        }
        writeFilePair(tmp, `${directory}/index`, `${directory}/index.ts`, barrelSource(directory));
        exportsMap[`./${directory}`] = {
            types: `./${directory}/index.d.ts`,
            default: `./${directory}/index.js`,
        };
    }

    writePackageJson(tmp, {
        name: "@gtkx/gi",
        type: "module",
        version: options.version,
        sideEffects: true,
        exports: exportsMap,
    });

    symlinkRelative(join(tmp, "node_modules", "@gtkx", "ffi"), options.realFfiDir);

    swapStore(tmp, options.storeDir, options.linkDir);
};
