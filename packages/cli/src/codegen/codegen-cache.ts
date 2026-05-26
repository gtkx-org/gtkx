import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = join("node_modules", ".cache", "gtkx");
const MANIFEST_FILE = "codegen-manifest.json";

type Manifest = {
    inputHash: string;
    codegenVersion: string;
    timestamp: number;
};

/**
 * Computes a stable hash of the inputs that determine codegen output.
 *
 * `libraries` must be the fully resolved namespace list — after the
 * `libraries` default and `"*"` expansion have been applied — so the hash
 * reflects the GIR set that will actually be generated.
 *
 * GIR file contents are intentionally NOT hashed: codegen is idempotent
 * against the same GIR set on the same system, and re-hashing dozens of MB of
 * XML on every CLI invocation is wasted work.
 *
 * Bumping the codegen version invalidates all caches, which is the right
 * forcing function when output formats change.
 *
 * @param libraries - Resolved GIR namespace identifiers driving this run
 * @param girPath - The user's configured `girPath`, if any
 * @param slotProps - The user's configured `slotProps` overrides, if any
 * @param codegenVersion - Version of `@gtkx/codegen` driving this run
 * @returns Hex SHA-256 digest of the input hash
 */
export const computeInputHash = (
    libraries: readonly string[],
    girPath: readonly string[] | undefined,
    slotProps: Readonly<Record<string, readonly string[]>> | undefined,
    codegenVersion: string,
): string => {
    const hash = createHash("sha256");
    hash.update(JSON.stringify({ libraries, girPath: girPath ?? [], slotProps: canonicalizeSlotProps(slotProps) }));
    hash.update("\n");
    hash.update(codegenVersion);
    return hash.digest("hex");
};

const canonicalizeSlotProps = (
    slotProps: Readonly<Record<string, readonly string[]>> | undefined,
): Array<[string, string[]]> => {
    if (!slotProps) return [];
    return Object.entries(slotProps)
        .map(([jsxName, props]) => [jsxName, [...props].sort((a, b) => a.localeCompare(b))] as [string, string[]])
        .sort(([a], [b]) => a.localeCompare(b));
};

/**
 * Reads the cache manifest from the project's `node_modules/.cache/gtkx/` dir
 * and compares its `inputHash` to the expected hash.
 *
 * @param projectRoot - Absolute path to the user's project root
 * @param expectedHash - The hash computed from current inputs via {@link computeInputHash}
 * @returns `true` if the manifest exists and matches, `false` otherwise
 */
export const isCacheValid = (projectRoot: string, expectedHash: string): boolean => {
    const manifestPath = join(projectRoot, CACHE_DIR, MANIFEST_FILE);
    if (!existsSync(manifestPath)) {
        return false;
    }

    try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
        return manifest.inputHash === expectedHash;
    } catch {
        return false;
    }
};

/**
 * Writes a cache manifest recording the hash, version, and timestamp of the
 * most recent successful codegen run.
 *
 * Creates the cache directory if it does not exist.
 *
 * @param projectRoot - Absolute path to the user's project root
 * @param inputHash - Hash from {@link computeInputHash}
 * @param codegenVersion - Version of `@gtkx/codegen` that produced the run
 */
export const writeCacheManifest = (projectRoot: string, inputHash: string, codegenVersion: string): void => {
    const cachePath = join(projectRoot, CACHE_DIR);
    mkdirSync(cachePath, { recursive: true });

    const manifest: Manifest = {
        inputHash,
        codegenVersion,
        timestamp: Date.now(),
    };

    writeFileSync(join(cachePath, MANIFEST_FILE), JSON.stringify(manifest, null, 2));
};
