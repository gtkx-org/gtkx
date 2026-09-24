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
    isComplete: boolean;
};

type ProjectImports = {
    imports: SourceImport[];
    isComplete: boolean;
};

const CACHE_FILE = ["node_modules", ".gtkx", "import-scan.json"];
const PARSER_MANIFEST = "vite/package.json";
const UNKNOWN_PARSER = "unknown";
const SCANNER_MODULES = ["./source-imports.js", "./import-scan.js"];
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
    SCANNER_MODULES.map((name) => moduleHash(new URL(import.meta.resolve(name)))).join("-");

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

const retainCached = (path: string, cached: ScannedFile | undefined, index: ScanIndex): "invalid" => {
    if (cached !== undefined) {
        index.set(path, cached);
    }

    return "invalid";
};

const scanFile = (path: string, previous: ScanIndex, index: ScanIndex): "changed" | "unchanged" | "invalid" => {
    const cached = previous.get(path);
    const code = readSource(path);

    if (code === null) {
        return retainCached(path, cached, index);
    }

    const hash = hashSource(code);

    if (cached?.hash === hash) {
        index.set(path, cached);

        return "unchanged";
    }

    const sources = importSourcesIn(path, code);

    if (sources === null) {
        return retainCached(path, cached, index);
    }

    index.set(path, { hash, sources });

    return "changed";
};

const scanSourceDir = (dir: string, previous: ScanIndex): ScanResult => {
    const index: ScanIndex = new Map();
    let isChanged = false;
    let isComplete = true;

    for (const path of discoverSourceFiles(dir)) {
        const result = scanFile(path, previous, index);
        isChanged ||= result === "changed";
        isComplete &&= result !== "invalid";
    }

    return { index, isChanged: isChanged || index.size !== previous.size, isComplete };
};

const toSourceImports = (index: ScanIndex): SourceImport[] =>
    sortSourceImports(
        [...index].flatMap(([importer, { sources }]) => sources.map((source) => ({ importer, source }))),
    );

const discoverProjectImports = (root: string): ProjectImports => {
    const dir = sourceDirFor(root);
    const path = scanCachePath(root);
    const cache = readCache(path);
    const previous = cache.get(dir) ?? new Map<string, ScannedFile>();
    const { index, isChanged, isComplete } = scanSourceDir(dir, previous);

    if (isComplete && (isChanged || !cache.has(dir))) {
        cache.set(dir, index);
        writeCache(path, cache);
    }

    return { imports: toSourceImports(index), isComplete };
};

export { discoverProjectImports };
