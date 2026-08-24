import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

type JsonObject = Record<string, unknown>;

const cliArguments = process.argv.slice(2);

const isObject = (value: unknown): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const registryRoot = (value: string): URL => {
    const url = new URL(value);

    if (!url.pathname.endsWith("/")) {
        url.pathname += "/";
    }

    return url;
};

const replaceRegistry = (resolved: string, source: URL, destination: URL): string => {
    let url: URL;

    try {
        url = new URL(resolved);
    } catch {
        return resolved;
    }

    if (url.origin !== source.origin || !url.pathname.startsWith(source.pathname)) {
        return resolved;
    }

    const relativePath = url.pathname.slice(source.pathname.length);
    const replacement = new URL(relativePath, destination);
    replacement.search = url.search;
    replacement.hash = url.hash;

    return replacement.href;
};

const normalizeEntry = (entry: unknown, source: URL, destination: URL): void => {
    if (isObject(entry) && typeof entry.resolved === "string") {
        entry.resolved = replaceRegistry(entry.resolved, source, destination);
    }
};

const normalizePackageLockRegistry = (
    lockfilePath: string,
    sourceRegistry: string,
    destinationRegistry: string,
): void => {
    const parsed: unknown = JSON.parse(readFileSync(lockfilePath, "utf8"));

    if (!isObject(parsed) || !isObject(parsed.packages)) {
        throw new TypeError("Expected an npm package lock with a packages table");
    }

    const source = registryRoot(sourceRegistry);
    const destination = registryRoot(destinationRegistry);

    for (const entry of Object.values(parsed.packages)) {
        normalizeEntry(entry, source, destination);
    }

    const temporaryPath = `${lockfilePath}.${randomUUID()}.tmp`;

    try {
        writeFileSync(temporaryPath, `${JSON.stringify(parsed, null, 4)}\n`, { flag: "wx" });
        renameSync(temporaryPath, lockfilePath);
    } finally {
        rmSync(temporaryPath, { force: true });
    }
};

const main = (): void => {
    const [lockfilePath, sourceRegistry, destinationRegistry, ...extra] = cliArguments;

    if (
        lockfilePath === undefined ||
        sourceRegistry === undefined ||
        destinationRegistry === undefined ||
        extra.length > 0
    ) {
        throw new TypeError("Expected a lockfile path, source registry, and destination registry");
    }

    normalizePackageLockRegistry(lockfilePath, sourceRegistry, destinationRegistry);
};

main();
