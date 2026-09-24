import { errorCode, errorMessage } from "@gtkx/utils";
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
import { basename, dirname, join, relative, sep } from "node:path";
import { keepFailedProject, type SourceModule } from "../compile.js";
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
};

type StoreLink = Pick<StoreOptions, "storeDir" | "linkDir">;

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

type PreparedStore = { dir: string; keepAt: string; link: StoreLink };
type StoreGeneration = { modifiedAt: number; path: string };

const STORE_DIR_MODE = 0o755;
const FAILED_STORE_SUFFIX = ".failed";
const RETAINED_GENERATIONS = 3;
const GENERATION_PREFIXES = [
    ".generation-",
    ".pair-generation-",
    ".gi-generation-",
    ".gi-legacy-",
    ".jsx-generation-",
    ".jsx-legacy-",
];

const subpathExport = (stem: string): { types: string; default: string } => ({
    types: `./${stem}.d.ts`,
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

const writePackageJson = (storeDir: string, manifest: Manifest): void => {
    writeFileSync(join(storeDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
};

const writeSourceFile = (storeDir: string, fileName: string, source: string): void => {
    const filePath = join(storeDir, fileName);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, source);
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

const prepareStore = (params: WriteStoreParams): PreparedStore => {
    const tmp = createTempStore(params.storeDir);
    const keepAt = `${params.storeDir}${FAILED_STORE_SUFFIX}`;

    try {
        buildTempStore(tmp, params);
    } catch (error) {
        throw keepFailedProject({ projectDir: tmp, keepAt, error });
    }

    return { dir: tmp, keepAt, link: params };
};

const pathEntry = (path: string): ReturnType<typeof lstatSync> | undefined =>
    lstatSync(path, { throwIfNoEntry: false });

const symlinkTarget = (linkPath: string, target: string): string =>
    relative(dirname(linkPath), target);

const replaceSymlink = (linkPath: string, target: string): void => {
    mkdirSync(dirname(linkPath), { recursive: true });
    const id = randomUUID();
    const temporary = join(dirname(linkPath), `.${basename(linkPath)}.link-${id}`);
    const previous = join(dirname(linkPath), `.${basename(linkPath)}.replaced-${id}`);
    const existing = pathEntry(linkPath);
    symlinkSync(symlinkTarget(linkPath, target), temporary, "dir");

    if (existing !== undefined && !existing.isSymbolicLink()) {
        renameSync(linkPath, previous);
    }

    try {
        renameSync(temporary, linkPath);
    } catch (error) {
        rmSync(temporary, { force: true });

        if (existsSync(previous)) {
            renameSync(previous, linkPath);
        }

        throw error;
    }

    rmSync(previous, { recursive: true, force: true });
};

const realpathOrUndefined = (path: string): string | undefined => {
    try {
        return realpathSync(path);
    } catch (error) {
        if (errorCode(error) === "ENOENT") {
            return undefined;
        }

        throw error;
    }
};

const isLinked = (path: string, target: string): boolean => {
    const resolved = realpathOrUndefined(target);

    return resolved !== undefined && realpathOrUndefined(path) === resolved;
};

const linkStore = (link: StoreLink): void => {
    if (!isLinked(link.linkDir, link.storeDir)) {
        replaceSymlink(link.linkDir, link.storeDir);
    }
};

const ensureStoreLink = (link: StoreLink): void => {
    if (existsSync(join(link.storeDir, "package.json"))) {
        linkStore(link);
    }
};

const generationPath = (root: string): string =>
    join(root, `.generation-${randomUUID()}`);

const readGeneration = (root: string, name: string): StoreGeneration => {
    const path = join(root, name);

    return { modifiedAt: statSync(path).mtimeMs, path };
};

const reclaimGenerations = (root: string, protectedPaths: Set<string>): void => {
    const generations = readdirSync(root, { withFileTypes: true })
        .filter((entry) =>
            entry.isDirectory() && GENERATION_PREFIXES.some((prefix) => entry.name.startsWith(prefix)))
        .map((entry) => readGeneration(root, entry.name))
        .toSorted((left, right) => right.modifiedAt - left.modifiedAt);
    const retained = Math.max(0, RETAINED_GENERATIONS - protectedPaths.size);
    const removable = generations.filter((entry) => !protectedPaths.has(entry.path)).slice(retained);

    for (const generation of removable) {
        rmSync(generation.path, { recursive: true, force: true });
    }
};

const discardPreparedStore = (prepared: PreparedStore | undefined): void => {
    if (prepared !== undefined) {
        rmSync(prepared.dir, { recursive: true, force: true });
    }
};

const pairRoot = (links: StoreLink[]): string => {
    const roots = new Set(links.map((link) => realpathSync(dirname(link.storeDir))));
    const root = roots.values().next().value;

    if (root === undefined || roots.size !== 1) {
        throw new Error("The generated @gtkx/gi and @gtkx/jsx stores must share one directory");
    }

    return root;
};

const pairStorePath = (pair: string, link: StoreLink): string =>
    join(pair, basename(link.storeDir));

const materializePairStore = (pair: string, link: StoreLink, prepared: PreparedStore | undefined): void => {
    const destination = pairStorePath(pair, link);

    if (prepared === undefined) {
        cpSync(realpathSync(link.storeDir), destination, { recursive: true });

        return;
    }

    renameSync(prepared.dir, destination);
};

const pinStorePair = (gi: StoreLink, jsx: StoreLink, pair: string): void => {
    const giDir = pairStorePath(pair, gi);
    const jsxDir = pairStorePath(pair, jsx);
    replaceSymlink(join(jsxDir, "node_modules", "@gtkx", "gi"), giDir);
};

const prepareStoreLinks = (root: string, links: StoreLink[]): void => {
    const current = join(root, "current");

    for (const link of links) {
        replaceSymlink(link.storeDir, join(current, basename(link.storeDir)));
        linkStore(link);
    }
};

const linkedGeneration = (root: string, storeDir: string): string | undefined => {
    const resolved = realpathOrUndefined(storeDir);

    if (resolved === undefined) {
        return undefined;
    }

    const [name] = relative(root, resolved).split(sep, 1);

    return name !== undefined && GENERATION_PREFIXES.some((prefix) => name.startsWith(prefix))
        ? join(root, name)
        : undefined;
};

const linkedGenerations = (root: string, links: StoreLink[]): Set<string> => {
    const generations: Set<string> = new Set();

    for (const link of links) {
        const generation = linkedGeneration(root, link.storeDir);

        if (generation !== undefined) {
            generations.add(generation);
        }
    }

    return generations;
};

const removeFailedStores = (stores: (PreparedStore | undefined)[]): void => {
    for (const store of stores) {
        if (store !== undefined) {
            rmSync(store.keepAt, { recursive: true, force: true });
        }
    }
};

const protectedGenerations = (
    generation: string,
    currentPath: string,
    linked: Set<string>,
): Set<string> => {
    const paths = new Set([...linked, generation]);
    const current = realpathOrUndefined(currentPath);

    if (current !== undefined) {
        paths.add(current);
    }

    return paths;
};

const discardUnpublishedGeneration = (generation: string, currentPath: string): void => {
    if (realpathOrUndefined(currentPath) !== generation) {
        rmSync(generation, { recursive: true, force: true });
    }
};

const existingJsxLink = (gi: StoreLink): StoreLink | undefined => {
    if (basename(gi.storeDir) !== "gi") {
        return undefined;
    }

    const storeDir = join(dirname(gi.storeDir), "jsx");

    return existsSync(join(storeDir, "package.json"))
        ? { storeDir, linkDir: join(dirname(gi.linkDir), "jsx") }
        : undefined;
};

const publishPreparedStore = (prepared: PreparedStore): void => {
    const { link } = prepared;
    const root = realpathSync(dirname(link.storeDir));
    const generation = generationPath(root);
    const currentPath = join(root, "current");
    const jsx = existingJsxLink(link);
    const links = jsx === undefined ? [link] : [link, jsx];
    const linked = linkedGenerations(root, links);
    mkdirSync(generation);

    try {
        renameSync(prepared.dir, pairStorePath(generation, link));

        if (jsx !== undefined) {
            materializePairStore(generation, jsx, undefined);
            pinStorePair(link, jsx, generation);
        }

        prepareStoreLinks(root, links);
        rmSync(prepared.keepAt, { recursive: true, force: true });
        reclaimGenerations(root, protectedGenerations(generation, currentPath, linked));
        replaceSymlink(currentPath, generation);
    } catch (error) {
        discardUnpublishedGeneration(generation, currentPath);
        throw error;
    }
};

const publishStorePair = (input: {
    gi: PreparedStore | undefined;
    giLink: StoreLink;
    jsx: PreparedStore | undefined;
    jsxLink: StoreLink;
}): void => {
    const links = [input.giLink, input.jsxLink];
    const root = pairRoot(links);
    const pair = generationPath(root);
    const currentPath = join(root, "current");
    const linked = linkedGenerations(root, links);
    mkdirSync(pair);

    try {
        materializePairStore(pair, input.giLink, input.gi);
        materializePairStore(pair, input.jsxLink, input.jsx);
        pinStorePair(input.giLink, input.jsxLink, pair);
        prepareStoreLinks(root, links);

        removeFailedStores([input.gi, input.jsx]);
        reclaimGenerations(root, protectedGenerations(pair, currentPath, linked));
        replaceSymlink(currentPath, pair);
    } catch (error) {
        discardUnpublishedGeneration(pair, currentPath);
        throw error;
    }
};

export {
    subpathExport,
    buildManifest,
    discardPreparedStore,
    ensureStoreLink,
    namespaceBarrel,
    prepareStore,
    publishPreparedStore,
    publishStorePair,
    type PreparedStore,
    type StoreOptions,
    type RawFile,
};
