import { errorMessage } from "@gtkx/utils";
import { randomUUID } from "node:crypto";
import {
    chmodSync,
    cpSync,
    type Dirent,
    existsSync,
    lstatSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    realpathSync,
    renameSync,
    rmSync,
    statSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { keepFailedProject, type SourceModule } from "../compile.js";
import { FINGERPRINT_FILENAME } from "../fingerprint.js";
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
} & Partial<Record<"owner", string>>;

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
    compileDependencies?: Record<string, string>;
    files: SourceModule[];
    manifest: Manifest;
    owner: string | undefined;
    rawFiles?: RawFile[];
};

type StoreIdentity = { anchor: string; owner: string };
type StoreGeneration = { modifiedAt: number; path: string };
type PreparedStore = { dir: string; keepAt: string; link: StoreLink };

const STORE_DIR_MODE = 0o755;
const FAILED_STORE_SUFFIX = ".failed";
const IDENTITY_FILENAME = ".codegen-owner.json";
const RETAINED_GENERATIONS = 3;

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

const prepareStore = (params: WriteStoreParams): PreparedStore => {
    const owner = resolveStoreOwner(params);
    const tmp = createTempStore(params.storeDir);
    const keepAt = `${params.storeDir}${FAILED_STORE_SUFFIX}`;

    try {
        buildTempStore(tmp, params, owner);
    } catch (error) {
        throw keepFailedProject({ projectDir: tmp, keepAt, error });
    }

    return { dir: tmp, keepAt, link: params };
};

const buildTempStore = (tmp: string, params: WriteStoreParams, owner: string | undefined): void => {
    writePackageJson(tmp, params.manifest);

    for (const file of params.files) {
        writeSourceFile(tmp, file.fileName, file.source);
    }

    compileStore({
        storeDir: tmp,
        files: params.files,
        packageName: params.manifest.name,
        dependencies: params.compileDependencies,
    });
    const rawFiles = params.rawFiles ?? [];

    for (const raw of rawFiles) {
        writeFileSync(join(tmp, raw.relativePath), raw.content);
    }

    if (owner !== undefined) {
        const identity: StoreIdentity = { anchor: realpathSync(dirname(params.storeDir)), owner };
        writeFileSync(join(tmp, IDENTITY_FILENAME), `${JSON.stringify(identity, null, 2)}\n`);
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

const hasPathEntry = (path: string): boolean => {
    try {
        lstatSync(path);

        return true;
    } catch {
        return false;
    }
};

const generationPath = (storeDir: string, kind: string): string =>
    join(
        dirname(storeDir),
        `.${basename(storeDir)}-${kind}-${String(Date.now())}-${String(process.pid)}-${randomUUID()}`,
    );

const isSymlink = (path: string): boolean => {
    try {
        return lstatSync(path).isSymbolicLink();
    } catch {
        return false;
    }
};

const publishPreparedStore = (prepared: PreparedStore): void => {
    const { link } = prepared;
    const generation = generationPath(link.storeDir, "generation");
    renameSync(prepared.dir, generation);

    if (hasPathEntry(link.storeDir) && !isSymlink(link.storeDir)) {
        symlinkRelative(link.linkDir, generation);
        renameSync(link.storeDir, generationPath(link.storeDir, "legacy"));
    }

    symlinkRelative(link.storeDir, generation);
    ensureStoreLink(link);
    reclaimGenerations(link.storeDir);
    rmSync(prepared.keepAt, { recursive: true, force: true });
};

const pairRoot = (links: StoreLink[]): string => {
    const roots = new Set(links.map((link) => realpathSync(dirname(link.storeDir))));

    if (roots.size !== 1) {
        throw new Error("The generated @gtkx/gi and @gtkx/jsx stores must share one directory");
    }

    const root = roots.values().next().value;

    if (root === undefined) {
        throw new Error("Cannot resolve the generated store directory");
    }

    return root;
};

const pairStorePath = (pair: string, link: StoreLink): string => join(pair, basename(link.storeDir));

const materializePairStore = (pair: string, link: StoreLink, prepared: PreparedStore | undefined): void => {
    const destination = pairStorePath(pair, link);

    if (prepared === undefined) {
        cpSync(realpathSync(link.storeDir), destination, { recursive: true });

        return;
    }

    renameSync(prepared.dir, destination);
};

const hasPairLayout = (current: string, links: StoreLink[]): boolean =>
    links.every((link) => {
        try {
            return realpathSync(link.storeDir) === realpathSync(pairStorePath(current, link));
        } catch {
            return false;
        }
    });

const materializeBaselineStore = (baseline: string, pair: string, link: StoreLink): void => {
    const destination = pairStorePath(baseline, link);

    if (!existsSync(join(link.storeDir, "package.json"))) {
        cpSync(pairStorePath(pair, link), destination, { recursive: true });

        return;
    }

    if (isSymlink(link.storeDir)) {
        symlinkRelative(destination, realpathSync(link.storeDir));

        return;
    }

    cpSync(link.storeDir, destination, { recursive: true });
};

const migrateStoreToPair = (current: string, baseline: string, link: StoreLink): void => {
    if (hasPathEntry(link.storeDir) && !isSymlink(link.storeDir)) {
        symlinkRelative(link.linkDir, pairStorePath(baseline, link));
        renameSync(link.storeDir, generationPath(link.storeDir, "legacy"));
    }

    symlinkRelative(link.storeDir, pairStorePath(current, link));
    symlinkRelative(link.linkDir, link.storeDir);
};

const migrateStoresToPair = (current: string, baseline: string, links: StoreLink[]): void => {
    for (const link of links) {
        migrateStoreToPair(current, baseline, link);
    }
};

const canonicalizeStoreLinks = (links: StoreLink[]): void => {
    for (const link of links) {
        symlinkRelative(link.linkDir, link.storeDir);
    }
};

const pinStorePair = (giDir: string, jsxDir: string): void => {
    const gi = realpathSync(giDir);
    const jsx = realpathSync(jsxDir);
    const link = join(jsx, "node_modules", "@gtkx", "gi");

    if (hasPathEntry(link) && !isSymlink(link)) {
        rmSync(link, { recursive: true, force: true });
    }

    symlinkRelative(link, gi);
};

const pinExistingStorePair = (gi: StoreLink, jsx: StoreLink): void => {
    if (existsSync(join(gi.storeDir, "package.json")) && existsSync(join(jsx.storeDir, "package.json"))) {
        pinStorePair(realpathSync(gi.storeDir), realpathSync(jsx.storeDir));
    }
};

const storedPairDirectories = (root: string): string[] => {
    const entries = readdirSync(root, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(".pair-generation-"))
        .map((entry) => join(root, entry.name));
};

const hasCompletePair = (pair: string, gi: StoreLink, jsx: StoreLink): boolean =>
    existsSync(join(pairStorePath(pair, gi), "package.json")) &&
    existsSync(join(pairStorePath(pair, jsx), "package.json"));

const pinStoredPairs = (root: string, gi: StoreLink, jsx: StoreLink): void => {
    for (const pair of storedPairDirectories(root)) {
        if (hasCompletePair(pair, gi, jsx)) {
            pinStorePair(pairStorePath(pair, gi), pairStorePath(pair, jsx));
        }
    }
};

const createBaselinePair = (root: string, pair: string, gi: StoreLink, jsx: StoreLink): string => {
    const baseline = generationPath(join(root, "pair"), "generation");
    mkdirSync(baseline);

    for (const link of [gi, jsx]) {
        materializeBaselineStore(baseline, pair, link);
    }

    pinStorePair(pairStorePath(baseline, gi), pairStorePath(baseline, jsx));

    return baseline;
};

const preparePairLayout = (root: string, pair: string, gi: StoreLink, jsx: StoreLink): string => {
    const current = join(root, "current");
    const links = [gi, jsx];

    if (hasPairLayout(current, links)) {
        canonicalizeStoreLinks(links);

        return current;
    }

    if (links.every((link) => !existsSync(join(link.storeDir, "package.json")))) {
        symlinkRelative(current, pair);
        migrateStoresToPair(current, pair, links);

        return current;
    }

    const baseline = createBaselinePair(root, pair, gi, jsx);
    symlinkRelative(current, baseline);
    migrateStoresToPair(current, baseline, links);

    return current;
};

const publishStorePair = (input: {
    gi: PreparedStore | undefined;
    giLink: StoreLink;
    jsx: PreparedStore | undefined;
    jsxLink: StoreLink;
}): void => {
    const links = [input.giLink, input.jsxLink];
    const root = pairRoot(links);
    const pair = generationPath(join(root, "pair"), "generation");
    mkdirSync(pair);
    materializePairStore(pair, input.giLink, input.gi);
    materializePairStore(pair, input.jsxLink, input.jsx);
    pinExistingStorePair(input.giLink, input.jsxLink);
    pinStoredPairs(root, input.giLink, input.jsxLink);
    const current = preparePairLayout(root, pair, input.giLink, input.jsxLink);
    symlinkRelative(current, pair);

    for (const prepared of [input.gi, input.jsx]) {
        if (prepared !== undefined) {
            rmSync(prepared.keepAt, { recursive: true, force: true });
        }
    }

    reclaimPairGenerations(root, links);
};

const discardPreparedStore = (prepared: PreparedStore | undefined): void => {
    if (prepared !== undefined) {
        rmSync(prepared.dir, { recursive: true, force: true });
    }
};

const isStoreGeneration = (entry: Dirent, storeName: string): boolean =>
    entry.isDirectory() &&
    (entry.name.startsWith(`.${storeName}-generation-`) || entry.name.startsWith(`.${storeName}-legacy-`));

const readGeneration = (parent: string, entry: Dirent): StoreGeneration | null => {
    const path = join(parent, entry.name);

    try {
        return { modifiedAt: statSync(path).mtimeMs, path };
    } catch {
        return null;
    }
};

const listGenerations = (storeDir: string): StoreGeneration[] => {
    const parent = realpathSync(dirname(storeDir));
    const storeName = basename(storeDir);

    return readdirSync(parent, { withFileTypes: true })
        .filter((entry) => isStoreGeneration(entry, storeName))
        .map((entry) => readGeneration(parent, entry))
        .filter((generation): generation is StoreGeneration => generation !== null);
};

const reclaimGenerations = (storeDir: string): void => {
    const current = realpathSync(storeDir);
    const previous = listGenerations(storeDir)
        .filter((generation) => generation.path !== current)
        .toSorted((left, right) => right.modifiedAt - left.modifiedAt);

    const removable = previous.slice(RETAINED_GENERATIONS - 1);

    for (const generation of removable) {
        rmSync(generation.path, { recursive: true, force: true });
    }
};

const listPairGenerations = (root: string): StoreGeneration[] =>
    readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(".pair-generation-"))
        .map((entry) => readGeneration(root, entry))
        .filter((generation): generation is StoreGeneration => generation !== null);

const retainedPairGenerations = (root: string): StoreGeneration[] => {
    const current = realpathSync(join(root, "current"));
    const previous = listPairGenerations(root)
        .filter((generation) => generation.path !== current)
        .toSorted((left, right) => right.modifiedAt - left.modifiedAt);

    const removable = previous.slice(RETAINED_GENERATIONS - 1);

    for (const generation of removable) {
        rmSync(generation.path, { recursive: true, force: true });
    }

    const retained = previous.slice(0, RETAINED_GENERATIONS - 1);

    return [{ modifiedAt: statSync(current).mtimeMs, path: current }, ...retained];
};

const referencedStoreGeneration = (pair: StoreGeneration, link: StoreLink): string | null => {
    try {
        return realpathSync(pairStorePath(pair.path, link));
    } catch {
        return null;
    }
};

const referencedStoreGenerations = (pairs: StoreGeneration[], links: StoreLink[]): Set<string> => {
    const referenced = pairs
        .flatMap((pair) => links.map((link) => referencedStoreGeneration(pair, link)))
        .filter((path): path is string => path !== null);

    return new Set(referenced);
};

const reclaimDetachedGenerations = (storeDir: string, referenced: Set<string>): void => {
    const generations = listGenerations(storeDir).toSorted((left, right) => right.modifiedAt - left.modifiedAt);
    const isReferenced = (generation: StoreGeneration): boolean => referenced.has(generation.path);
    const protectedCount = generations.filter((generation) => isReferenced(generation)).length;
    const retainedUnreferenced = Math.max(0, RETAINED_GENERATIONS - protectedCount);
    const unreferenced = generations.filter((generation) => !isReferenced(generation));
    const removable = unreferenced.slice(retainedUnreferenced);

    for (const generation of removable) {
        rmSync(generation.path, { recursive: true, force: true });
    }
};

const reclaimPairGenerations = (root: string, links: StoreLink[]): void => {
    const pairs = retainedPairGenerations(root);
    const referenced = referencedStoreGenerations(pairs, links);

    for (const link of links) {
        reclaimDetachedGenerations(link.storeDir, referenced);
    }
};

const isStoreLinked = (link: StoreLink): boolean => {
    try {
        return realpathSync(link.linkDir) === realpathSync(link.storeDir);
    } catch {
        return false;
    }
};

const ensureStoreLink = (link: StoreLink): void => {
    if (!existsSync(join(link.storeDir, "package.json"))) {
        return;
    }

    if (!isStoreLinked(link)) {
        symlinkRelative(link.linkDir, link.storeDir);
    }
};

const readJson = (path: string): unknown => {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch {
        return null;
    }
};

const storeIdentity = (storeDir: string): StoreIdentity | null => {
    const value = readJson(join(storeDir, IDENTITY_FILENAME));

    if (
        typeof value === "object" &&
        value !== null &&
        "anchor" in value &&
        "owner" in value &&
        typeof value.anchor === "string" &&
        typeof value.owner === "string"
    ) {
        return { anchor: value.anchor, owner: value.owner };
    }

    return null;
};

const fingerprintValue = (value: unknown): string | null => {
    if (typeof value === "object" && value !== null && "value" in value && typeof value.value === "string") {
        return value.value;
    }

    return null;
};

const desiredFingerprint = (rawFiles: RawFile[] | undefined): string | null => {
    const fingerprint = rawFiles?.find((file) => file.relativePath === FINGERPRINT_FILENAME);

    return fingerprint === undefined ? null : fingerprintValue(readJsonSource(fingerprint.content));
};

const readJsonSource = (source: string): unknown => {
    try {
        return JSON.parse(source);
    } catch {
        return null;
    }
};

const resolveStoreOwner = (params: WriteStoreParams): string | undefined => {
    const { owner } = params;

    if (owner === undefined) {
        return undefined;
    }

    mkdirSync(dirname(params.storeDir), { recursive: true });
    const identity = storeIdentity(params.storeDir);
    const anchor = realpathSync(dirname(params.storeDir));

    if (
        identity?.anchor !== anchor ||
        identity.owner === owner ||
        !existsSync(identity.owner)
    ) {
        return owner;
    }

    const current = fingerprintValue(readJson(join(params.storeDir, FINGERPRINT_FILENAME)));
    const desired = desiredFingerprint(params.rawFiles);

    if (current !== desired || current === null) {
        throw new Error(
            `Cannot replace the generated ${params.manifest.name} store shared with ${identity.owner}; ` +
            "the projects require different generated bindings.",
        );
    }

    return identity.owner;
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
    publishPreparedStore,
    publishStorePair,
    type PreparedStore,
    type StoreOptions,
    type RawFile,
};
