import { isRecord } from "@gtkx/utils";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
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

type ScanIndex = Record<string, string[]>;

type ScanCache = z.infer<typeof cacheSchema>;

type ScanResult = {
    index: ScanIndex;
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
const cacheSchema = z.object({
    version: z.string(),
    dirs: z.record(z.string(), z.record(z.string(), z.array(z.string()).catch([])).catch({})),
});

const scanCachePath = (root: string): string => join(root, ...CACHE_FILE);

const readJson = (path: string | URL): unknown => {
    try {
        return JSON.parse(readFileSync(path, "utf8")) as unknown;
    } catch {
        return undefined;
    }
};

const parserVersion = (): string => {
    const manifest = readJson(new URL(import.meta.resolve(PARSER_MANIFEST)));

    return isRecord(manifest) && typeof manifest.version === "string" ? manifest.version : UNKNOWN_PARSER;
};

const scannerHash = (): string =>
    SCANNER_MODULES.map((name) => moduleHash(new URL(import.meta.resolve(name)))).join("-");

const cacheVersion = (): string =>
    (identity.value ??= `${packageManifest.version}+${parserVersion()}+${scannerHash()}`);

const readCache = (path: string): ScanCache => {
    const parsed = cacheSchema.safeParse(readJson(path));

    if (!parsed.success || parsed.data.version !== cacheVersion()) {
        return { version: cacheVersion(), dirs: {} };
    }

    return {
        version: parsed.data.version,
        dirs: Object.fromEntries(Object.entries(parsed.data.dirs).filter(([dir]) => existsSync(dir))),
    };
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

const writeCache = (path: string, cache: ScanCache): void => {
    try {
        mkdirSync(dirname(path), { recursive: true });
    } catch {
        return;
    }

    pruneStaging(path);
    writeAtomically(path, JSON.stringify(cache));
};

const scanSourceDir = (dir: string, previous: ScanIndex): ScanResult => {
    const index: ScanIndex = {};
    let isComplete = true;

    for (const path of discoverSourceFiles(dir)) {
        const code = readSource(path);
        const sources = code === null ? null : importSourcesIn(path, code);
        isComplete &&= sources !== null;
        const retained = sources ?? previous[path];

        if (retained !== undefined) {
            index[path] = retained;
        }
    }

    return { index, isComplete };
};

const toSourceImports = (index: ScanIndex): SourceImport[] =>
    sortSourceImports(
        Object.entries(index).flatMap(([importer, sources]) => sources.map((source) => ({ importer, source }))),
    );

const discoverProjectImports = (root: string): ProjectImports => {
    const dir = sourceDirFor(root);
    const path = scanCachePath(root);
    const cache = readCache(path);
    const previous = cache.dirs[dir];
    const { index, isComplete } = scanSourceDir(dir, previous ?? {});

    if (isComplete && JSON.stringify(previous) !== JSON.stringify(index)) {
        cache.dirs[dir] = index;
        writeCache(path, cache);
    }

    return { imports: toSourceImports(index), isComplete };
};

export { discoverProjectImports };
