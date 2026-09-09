import type { ResolvedReactCompilerOptions } from "@gtkx/config/internal";
import { isRecord } from "@gtkx/utils";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import packageManifest from "../../package.json" with { type: "json" };

type CompilerOutput = { code: string; map?: string };

type ReactCompilerCache = {
    keyFor: (code: string, id: string) => string;
    read: (key: string) => CompilerOutput | undefined;
    write: (key: string, output: CompilerOutput) => void;
};

type ToolchainWalk = {
    identities: Set<string>;
    queue: [string, string][];
    visited: Set<string>;
};

const CACHE_NAME = "gtkx-react-compiler";
const CACHE_VERSION = "1";
const ENTRY_SUFFIX = ".json";
const STAGING_SUFFIX = ".tmp";
const GENERATION_LENGTH = 16;
const MAX_ENTRIES = 2048;
const TOOLCHAIN_PACKAGES = ["@babel/core", "@babel/preset-typescript", "babel-plugin-react-compiler"];
const toolchain: { value: string | undefined } = { value: undefined };
const staging = { count: 0 };

const readText = (path: string): string | undefined => {
    try {
        return readFileSync(path, "utf8");
    } catch {
        return undefined;
    }
};

const readManifest = (path: string): unknown => {
    const contents = readText(path);

    if (contents === undefined) {
        return undefined;
    }

    try {
        return JSON.parse(contents) as unknown;
    } catch {
        return undefined;
    }
};

const manifestIdentity = (value: unknown): string | undefined =>
    isRecord(value) && typeof value.name === "string" && typeof value.version === "string"
        ? `${value.name}@${value.version}`
        : undefined;

const tryResolve = (resolver: NodeJS.Require, specifier: string): string | undefined => {
    try {
        return resolver.resolve(specifier);
    } catch {
        return undefined;
    }
};

const manifestNear = (entry: string, name: string): string | undefined => {
    for (let dir = dirname(entry); dir !== dirname(dir); dir = dirname(dir)) {
        const candidate = join(dir, "package.json");

        if (manifestIdentity(readManifest(candidate))?.startsWith(`${name}@`) === true) {
            return candidate;
        }
    }

    return undefined;
};

const manifestPathFor = (name: string, from: string): string | undefined => {
    const resolver = createRequire(from);
    const direct = tryResolve(resolver, `${name}/package.json`);

    if (direct !== undefined) {
        return direct;
    }

    const entry = tryResolve(resolver, name);

    return entry === undefined ? undefined : manifestNear(entry, name);
};

const visitPackage = (name: string, from: string, walk: ToolchainWalk): void => {
    const path = manifestPathFor(name, from);

    if (path === undefined || walk.visited.has(path)) {
        return;
    }

    walk.visited.add(path);
    const manifest = readManifest(path);
    const identity = manifestIdentity(manifest);

    if (identity !== undefined) {
        walk.identities.add(identity);
    }

    if (isRecord(manifest) && isRecord(manifest.dependencies)) {
        const dependencies = Object.keys(manifest.dependencies);
        walk.queue.push(...dependencies.map((dependency): [string, string] => [dependency, path]));
    }
};

const computeToolchainKey = (): string => {
    const walk: ToolchainWalk = {
        identities: new Set(),
        queue: TOOLCHAIN_PACKAGES.map((name): [string, string] => [name, import.meta.filename]),
        visited: new Set(),
    };

    for (const [name, from] of walk.queue) {
        visitPackage(name, from, walk);
    }

    const identities = [...walk.identities].toSorted((left, right) => left.localeCompare(right));

    return createHash("sha256").update(identities.join(",")).digest("hex");
};

const toolchainKey = (): string => (toolchain.value ??= computeToolchainKey());

const stagingPath = (path: string): string => {
    staging.count += 1;

    return `${path}.${String(process.pid)}.${String(staging.count)}${STAGING_SUFFIX}`;
};

const writeAtomically = (path: string, contents: string): void => {
    const temporary = stagingPath(path);

    try {
        writeFileSync(temporary, contents);
        renameSync(temporary, path);
    } catch {
        rmSync(temporary, { force: true });
    }
};

const entryTime = (path: string): number => {
    try {
        return statSync(path).mtimeMs;
    } catch {
        return 0;
    }
};

const pruneEntries = (dir: string, names: string[]): void => {
    const keys = names.filter((name) => name.endsWith(ENTRY_SUFFIX)).map((name) => name.slice(0, -ENTRY_SUFFIX.length));

    if (keys.length <= MAX_ENTRIES) {
        return;
    }

    const ordered = keys
        .map((key) => ({ key, time: entryTime(join(dir, `${key}${ENTRY_SUFFIX}`)) }))
        .toSorted((left, right) => left.time - right.time);
    const expired = ordered.slice(0, keys.length - MAX_ENTRIES / 2);

    for (const entry of expired) {
        rmSync(join(dir, `${entry.key}${ENTRY_SUFFIX}`), { force: true });
    }
};

const pruneGenerations = (root: string, generation: string): void => {
    const names = readdirSync(root);

    for (const name of names) {
        if (name !== generation) {
            rmSync(join(root, name), { force: true, recursive: true });
        }
    }
};

const pruneStaging = (dir: string, names: string[]): void => {
    const stale = names.filter((entry) => entry.endsWith(STAGING_SUFFIX));

    for (const name of stale) {
        rmSync(join(dir, name), { force: true });
    }
};

const prepareCacheDir = (root: string, generation: string): string | null => {
    const dir = join(root, generation);

    try {
        mkdirSync(dir, { recursive: true });
        pruneGenerations(root, generation);
        const names = readdirSync(dir);
        pruneStaging(dir, names);
        pruneEntries(dir, names);

        return dir;
    } catch {
        return null;
    }
};

const compilerOutput = (value: unknown): CompilerOutput | undefined => {
    if (!isRecord(value) || typeof value.code !== "string") {
        return undefined;
    }

    return typeof value.map === "string" ? { code: value.code, map: value.map } : { code: value.code };
};

const readEntry = (dir: string, key: string): CompilerOutput | undefined =>
    compilerOutput(readManifest(join(dir, `${key}${ENTRY_SUFFIX}`)));

const writeEntry = (dir: string, key: string, output: CompilerOutput): void => {
    writeAtomically(join(dir, `${key}${ENTRY_SUFFIX}`), JSON.stringify(output));
};

const cacheIdentity = (options: ResolvedReactCompilerOptions, generation: string): string =>
    [
        CACHE_VERSION,
        packageManifest.version,
        generation,
        JSON.stringify(options),
        String(process.env.NODE_ENV),
    ].join("\0");

const createReactCompilerCache = (
    cacheDir: string,
    options: ResolvedReactCompilerOptions,
): ReactCompilerCache | null => {
    const root = join(cacheDir, CACHE_NAME);
    const generation = toolchainKey().slice(0, GENERATION_LENGTH);
    const dir = prepareCacheDir(root, generation);

    if (dir === null) {
        return null;
    }

    const identity = cacheIdentity(options, generation);

    return {
        keyFor: (code, id) =>
            createHash("sha256").update(identity).update("\0").update(id).update("\0").update(code).digest("hex"),
        read: (key) => readEntry(dir, key),
        write: (key, output) => {
            writeEntry(dir, key, output);
        },
    };
};

export { type CompilerOutput, createReactCompilerCache, type ReactCompilerCache };
