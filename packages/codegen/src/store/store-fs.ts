import { errorMessage } from "@gtkx/utils";
import { randomUUID } from "node:crypto";
import {
    chmodSync,
    cpSync,
    existsSync,
    lstatSync,
    mkdirSync,
    readdirSync,
    realpathSync,
    renameSync,
    rmSync,
    statSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { z } from "zod";
import { keepFailedProject, type SourceModule } from "../compile.js";
import { readJsonFile } from "../json.js";
import { createStagingDir } from "../staging.js";
import { compileStore } from "./compile-store.js";

/** Where one generated store is written and how it is reached. */
type StoreOptions = {
    /** Directory the generated package is written to, replaced atomically on each run. */
    storeDir: string;
    /** Path the store is symlinked at, which is the specifier's resolution target under `node_modules`. */
    linkDir: string;
    /** Version stamped on the store's `package.json`, taken from the dependency the store is generated for. */
    version: string;
    /**
     * Packages the generated modules import, mapped to the installed directories they should load. Each is linked
     * beside the store, so the bindings import the project's copies wherever the store is placed.
     */
    dependencies?: Record<string, string>;
} & Partial<Record<"owner", string>>;

type StoreLink = Pick<StoreOptions, "storeDir" | "linkDir" | "dependencies">;

type Manifest = {
    name: string;
    type: "module";
    version: string;
    sideEffects: boolean | string[];
    exports: Record<string, unknown>;
    peerDependencies?: Record<string, string>;
};

type ManifestInput = {
    name: string;
    version: string;
    exports: Record<string, unknown>;
    sideEffects?: boolean | string[];
    peerDependencies?: Record<string, string>;
};

type RawFile = { relativePath: string; content: string };

type WriteStoreParams = Pick<StoreOptions, "storeDir" | "linkDir"> & {
    files: SourceModule[];
    manifest: Manifest;
    rawFiles?: RawFile[];
};

type PreparedStore = { dir: string; keepAt: string };

const jsxManifestSchema = z.object({ name: z.literal("@gtkx/jsx") });

const STORE_DIR_MODE = 0o755;
const FAILED_STORE_SUFFIX = ".failed";
const RETAINED_GENERATIONS = 3;

const subpathExport = (stem: string): { types: string; import: string; require: null; default: string } => ({
    types: `./${stem}.d.ts`,
    import: `./${stem}.js`,
    require: null,
    default: `./${stem}.js`,
});

const namespaceBarrel = (directory: string): { fileName: string; source: string } => ({
    fileName: `${directory}/index.ts`,
    source: `export * from "./${directory}.js";\n`,
});

const buildManifest = (input: ManifestInput): Manifest => {
    const manifest: Manifest = {
        name: input.name,
        type: "module",
        version: input.version,
        sideEffects: input.sideEffects ?? true,
        exports: { "./package.json": "./package.json", ...input.exports },
    };

    if (input.peerDependencies) {
        manifest.peerDependencies = input.peerDependencies;
    }

    return manifest;
};

const prepareStore = (params: WriteStoreParams): PreparedStore => {
    const tmp = createTempStore(params.storeDir);
    const keepAt = `${params.storeDir}${FAILED_STORE_SUFFIX}`;

    try {
        buildTempStore(tmp, params);
    } catch (error) {
        throw keepFailedProject({ projectDir: tmp, keepAt, error });
    }

    return { dir: tmp, keepAt };
};

const buildTempStore = (tmp: string, params: WriteStoreParams): void => {
    writePackageJson(tmp, params.manifest);

    for (const file of params.files) {
        writeSourceFile(tmp, file.fileName, file.source);
    }

    compileStore({
        storeDir: tmp,
        files: params.files,
        packageName: params.manifest.name,
    });
    const rawFiles = params.rawFiles ?? [];

    for (const raw of rawFiles) {
        writeFileSync(join(tmp, raw.relativePath), raw.content);
    }
};

const writeSourceFile = (storeDir: string, fileName: string, source: string): void => {
    const filePath = join(storeDir, fileName);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, source);
};

const symlinkRelative = (linkPath: string, realTarget: string): void => {
    mkdirSync(dirname(linkPath), { recursive: true });
    const temporary = join(dirname(linkPath), `.${basename(linkPath)}.link-${String(process.pid)}-${randomUUID()}`);
    symlinkSync(relative(dirname(linkPath), realTarget), temporary, "dir");

    try {
        renameSync(temporary, linkPath);
    } catch (error) {
        rmSync(temporary, { force: true });
        throw error;
    }
};

const writePackageJson = (storeDir: string, manifest: Manifest): void => {
    writeFileSync(join(storeDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
};

const realpathOrNull = (path: string): string | null => {
    try {
        return realpathSync(path);
    } catch {
        return null;
    }
};

const storeRoot = (gi: StoreLink, jsx?: StoreLink): string => {
    const root = realpathSync(dirname(gi.storeDir));

    if (jsx !== undefined && realpathSync(dirname(jsx.storeDir)) !== root) {
        throw new Error("The generated @gtkx/gi and @gtkx/jsx stores must share one directory");
    }

    return join(root, `.${basename(gi.storeDir)}-store`);
};

const hasStoreLayout = (gi: StoreLink, jsx?: StoreLink): boolean => {
    const root = storeRoot(gi, jsx);
    const current = realpathOrNull(join(root, "current"));

    return (
        current !== null &&
        dirname(current) === root &&
        basename(current).startsWith(".generation-") &&
        realpathOrNull(gi.storeDir) === join(current, "gi") &&
        existsSync(join(current, "gi", "package.json")) &&
        (jsx === undefined
            ? !existsSync(join(current, "jsx"))
            : realpathOrNull(jsx.storeDir) === join(current, "jsx") && existsSync(join(current, "jsx", "package.json")))
    );
};

const materializeStore = (destination: string, link: StoreLink, prepared: PreparedStore | undefined): void => {
    if (prepared === undefined) {
        cpSync(realpathSync(link.storeDir), destination, { recursive: true });
    } else {
        renameSync(prepared.dir, destination);
    }
};

const replaceStoreLink = (linkPath: string, target: string): void => {
    if (lstatSync(linkPath, { throwIfNoEntry: false })?.isDirectory()) {
        rmSync(linkPath, { recursive: true });
    }

    symlinkRelative(linkPath, target);
};

const reclaimStoreArtifacts = (gi: StoreLink): void => {
    const root = storeRoot(gi);
    const current = realpathOrNull(join(root, "current"));

    if (current === null || !basename(current).startsWith(".generation-")) {
        return;
    }

    const entries = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    const previous = entries
        .filter((entry) => entry.name.startsWith(".generation-") && join(root, entry.name) !== current)
        .map((entry) => ({ path: join(root, entry.name), modifiedAt: statSync(join(root, entry.name)).mtimeMs }))
        .toSorted((left, right) => right.modifiedAt - left.modifiedAt);
    for (const entry of previous.slice(RETAINED_GENERATIONS - 1)) {
        rmSync(entry.path, { recursive: true, force: true });
    }
};

const publishStores = (input: {
    gi: PreparedStore | undefined;
    giLink: StoreOptions;
    jsx?: PreparedStore | undefined;
    jsxLink?: StoreOptions | undefined;
}): void => {
    const { giLink, jsxLink } = input;
    const root = storeRoot(giLink, jsxLink);
    const current = join(root, "current");
    const legacyJsx = basename(giLink.storeDir) === "gi" ? join(dirname(root), "jsx") : undefined;
    const obsoleteJsx =
        jsxLink === undefined && legacyJsx !== undefined
            ? [legacyJsx, join(dirname(giLink.linkDir), "jsx")].filter(
                  (path) =>
                      path !== giLink.storeDir &&
                      path !== giLink.linkDir &&
                      jsxManifestSchema.safeParse(readJsonFile(join(path, "package.json"))).success,
              )
            : [];

    const generation = join(root, `.generation-${String(Date.now())}-${randomUUID()}`);
    mkdirSync(generation, { recursive: true });

    try {
        materializeStore(join(generation, "gi"), giLink, input.gi);

        if (jsxLink !== undefined) {
            materializeStore(join(generation, "jsx"), jsxLink, input.jsx);
            const giPin = join(generation, "jsx", "node_modules", "@gtkx", "gi");
            replaceStoreLink(giPin, join(generation, "gi"));
        }

        for (const [name, link] of [
            ["gi", giLink],
            ["jsx", jsxLink],
        ] as const) {
            if (link !== undefined) {
                replaceStoreLink(link.storeDir, join(current, name));
                replaceStoreLink(link.linkDir, link.storeDir);
            }
        }

        symlinkRelative(current, generation);
    } catch (error) {
        rmSync(generation, { recursive: true, force: true });
        throw error;
    }

    for (const path of obsoleteJsx) {
        rmSync(path, { recursive: true, force: true });
    }

    for (const prepared of [input.gi, input.jsx]) {
        if (prepared !== undefined) {
            rmSync(prepared.keepAt, { recursive: true, force: true });
        }
    }

    reclaimStoreArtifacts(giLink);
};

const discardPreparedStore = (prepared: PreparedStore | undefined): void => {
    if (prepared !== undefined) {
        rmSync(prepared.dir, { recursive: true, force: true });
    }
};

const isStoreLinked = (link: StoreLink): boolean => {
    try {
        return realpathSync(link.linkDir) === realpathSync(link.storeDir);
    } catch {
        return false;
    }
};

const linkStoreDependencies = (link: StoreLink): void => {
    for (const [name, directory] of Object.entries(link.dependencies ?? {})) {
        const path = join(dirname(link.storeDir), "node_modules", name);

        if (realpathOrNull(path) !== directory) {
            symlinkRelative(path, directory);
        }
    }
};

const ensureStoreLink = (link: StoreLink): void => {
    if (!existsSync(join(link.storeDir, "package.json"))) {
        return;
    }

    linkStoreDependencies(link);

    if (!isStoreLinked(link)) {
        symlinkRelative(link.linkDir, link.storeDir);
    }
};

const storeWriteMessage = (storeDir: string, error: unknown): string =>
    `Cannot write the generated store to ${storeDir}: ${errorMessage(error)}. ` +
    "Codegen writes the store into the node_modules the @gtkx packages resolve from, " +
    `so ${dirname(storeDir)} has to be writable.`;

const createTempStore = (storeDir: string): string => {
    try {
        const tmp = createStagingDir(storeDir);
        chmodSync(tmp, STORE_DIR_MODE);

        return tmp;
    } catch (error) {
        throw new Error(storeWriteMessage(storeDir, error), { cause: error });
    }
};

export {
    subpathExport,
    buildManifest,
    discardPreparedStore,
    ensureStoreLink,
    namespaceBarrel,
    prepareStore,
    hasStoreLayout,
    linkStoreDependencies,
    publishStores,
    reclaimStoreArtifacts,
    type PreparedStore,
    type StoreOptions,
    type RawFile,
};
