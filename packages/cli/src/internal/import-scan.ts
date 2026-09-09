import { isRecord } from "@gtkx/utils";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import packageManifest from "../../package.json" with { type: "json" };
import {
    discoverSourceFiles,
    importSourcesIn,
    readSource,
    sortSourceImports,
    sourceDirFor,
    type SourceImport,
} from "./source-imports.js";

type ScannedFile = {
    hash: string;
    sources: string[];
};

type ScanIndex = Map<string, ScannedFile>;

type ScanResult = {
    index: ScanIndex;
    isChanged: boolean;
};

const CACHE_FILE = ["node_modules", ".gtkx", "import-scan.json"];

const scanCachePath = (root: string): string => join(root, ...CACHE_FILE);

const hashSource = (code: string): string => createHash("sha256").update(code).digest("hex");

const readJson = (path: string): unknown => {
    try {
        return JSON.parse(readFileSync(path, "utf8")) as unknown;
    } catch {
        return undefined;
    }
};

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((entry) => typeof entry === "string");

const scannedFile = (value: unknown): ScannedFile | null => {
    if (!isRecord(value)) {
        return null;
    }

    const { hash, sources } = value;

    return typeof hash === "string" && isStringArray(sources) ? { hash, sources } : null;
};

const cachedFiles = (parsed: unknown, dir: string): unknown => {
    if (!isRecord(parsed) || parsed.version !== packageManifest.version || parsed.dir !== dir) {
        return undefined;
    }

    return parsed.files;
};

const readIndex = (path: string, dir: string): ScanIndex => {
    const files = cachedFiles(readJson(path), dir);
    const index: ScanIndex = new Map();

    if (!isRecord(files)) {
        return index;
    }

    for (const [file, value] of Object.entries(files)) {
        const entry = scannedFile(value);

        if (entry !== null) {
            index.set(file, entry);
        }
    }

    return index;
};

const writeIndex = (path: string, dir: string, index: ScanIndex): void => {
    const temporary = `${path}.${String(process.pid)}`;
    const payload = { version: packageManifest.version, dir, files: Object.fromEntries(index) };

    try {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(temporary, JSON.stringify(payload));
        renameSync(temporary, path);
    } catch {
        rmSync(temporary, { force: true });
    }
};

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether the file was rescanned */
const scanFile = (path: string, previous: ScanIndex, index: ScanIndex): boolean => {
    const code = readSource(path);

    if (code === null) {
        return true;
    }

    const hash = hashSource(code);
    const cached = previous.get(path);
    const sources = cached?.hash === hash ? cached.sources : importSourcesIn(path, code);
    index.set(path, { hash, sources });

    return cached?.hash !== hash;
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
    const previous = readIndex(path, dir);
    const { index, isChanged } = scanSourceDir(dir, previous);

    if (isChanged) {
        writeIndex(path, dir, index);
    }

    return toSourceImports(index);
};

export { discoverProjectImports };
