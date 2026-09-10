import { isRecord } from "@gtkx/utils";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import packageManifest from "../../package.json" with { type: "json" };
import { moduleHash } from "./module-hash.js";
import {
    discoverSourceFiles,
    importSourcesIn,
    readSource,
    sortSourceImports,
    sourceDirFor,
    type SourceImport,
} from "./source-imports.js";
import { isStagingOwnerRunning, STAGING_SUFFIX, writeAtomically } from "./staging-file.js";

type ScannedFile = {
    hash: string;
    sources: string[];
};

type ScanIndex = Map<string, ScannedFile>;

type ScanCache = Map<string, ScanIndex>;

type ScanResult = {
    index: ScanIndex;
    isChanged: boolean;
};

const CACHE_FILE = ["node_modules", ".gtkx", "import-scan.json"];
const PARSER_MANIFEST = "vite/package.json";
const UNKNOWN_PARSER = "unknown";
const SCANNER_MODULES = ["source-imports", "import-scan"];
const identity: { value: string | undefined } = { value: undefined };

const scanCachePath = (root: string): string => join(root, ...CACHE_FILE);

const hashSource = (code: string): string => createHash("sha256").update(code).digest("hex");

const readJson = (path: string): unknown => {
    try {
        return JSON.parse(readFileSync(path, "utf8")) as unknown;
    } catch {
        return undefined;
    }
};

const parserVersion = (): string => {
    const manifest = readJson(createRequire(import.meta.url).resolve(PARSER_MANIFEST));

    return isRecord(manifest) && typeof manifest.version === "string" ? manifest.version : UNKNOWN_PARSER;
};

const scannerHash = (): string =>
    SCANNER_MODULES.map((name) => moduleHash(join(import.meta.dirname, name))).join("-");

const cacheVersion = (): string =>
    (identity.value ??= `${packageManifest.version}+${parserVersion()}+${scannerHash()}`);

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((entry) => typeof entry === "string");

const scannedFile = (value: unknown): ScannedFile | null => {
    if (!isRecord(value)) {
        return null;
    }

    const { hash, sources } = value;

    return typeof hash === "string" && isStringArray(sources) ? { hash, sources } : null;
};

const scanIndexFrom = (value: unknown): ScanIndex => {
    const index: ScanIndex = new Map();

    if (!isRecord(value)) {
        return index;
    }

    for (const [file, entry] of Object.entries(value)) {
        const scanned = scannedFile(entry);

        if (scanned !== null) {
            index.set(file, scanned);
        }
    }

    return index;
};

const readCache = (path: string): ScanCache => {
    const parsed = readJson(path);
    const cache: ScanCache = new Map();

    if (!isRecord(parsed) || parsed.version !== cacheVersion() || !isRecord(parsed.dirs)) {
        return cache;
    }

    for (const [dir, files] of Object.entries(parsed.dirs)) {
        if (existsSync(dir)) {
            cache.set(dir, scanIndexFrom(files));
        }
    }

    return cache;
};

const pruneStaging = (path: string): void => {
    const dir = dirname(path);
    const prefix = `${basename(path)}.`;

    let names: string[];

    try {
        names = readdirSync(dir);
    } catch {
        return;
    }

    for (const name of names) {
        if (name.startsWith(prefix) && name.endsWith(STAGING_SUFFIX) && !isStagingOwnerRunning(name)) {
            rmSync(join(dir, name), { force: true });
        }
    }
};

const cachePayload = (cache: ScanCache): unknown => ({
    version: cacheVersion(),
    dirs: Object.fromEntries([...cache].map(([dir, index]) => [dir, Object.fromEntries(index)])),
});

const writeCache = (path: string, cache: ScanCache): void => {
    try {
        mkdirSync(dirname(path), { recursive: true });
    } catch {
        return;
    }

    pruneStaging(path);
    writeAtomically(path, JSON.stringify(cachePayload(cache)));
};

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether the file was rescanned */
const scanFile = (path: string, previous: ScanIndex, index: ScanIndex): boolean => {
    const code = readSource(path);

    if (code === null) {
        return previous.has(path);
    }

    const hash = hashSource(code);
    const cached = previous.get(path);

    if (cached?.hash === hash) {
        index.set(path, cached);

        return false;
    }

    const sources = importSourcesIn(path, code);

    if (sources === null) {
        return previous.has(path);
    }

    index.set(path, { hash, sources });

    return true;
};

const scanSourceDir = (dir: string, previous: ScanIndex): ScanResult => {
    const index: ScanIndex = new Map();
    let isChanged = false;

    for (const path of discoverSourceFiles(dir)) {
        if (scanFile(path, previous, index)) {
            isChanged = true;
        }
    }

    return { index, isChanged: isChanged || index.size !== previous.size };
};

const toSourceImports = (index: ScanIndex): SourceImport[] =>
    sortSourceImports(
        [...index].flatMap(([importer, { sources }]) => sources.map((source) => ({ importer, source }))),
    );

const discoverProjectImports = (root: string): SourceImport[] => {
    const dir = sourceDirFor(root);
    const path = scanCachePath(root);
    const cache = readCache(path);
    const previous = cache.get(dir) ?? new Map<string, ScannedFile>();
    const { index, isChanged } = scanSourceDir(dir, previous);

    if (isChanged || !cache.has(dir)) {
        cache.set(dir, index);
        writeCache(path, cache);
    }

    return toSourceImports(index);
};

export { discoverProjectImports };
