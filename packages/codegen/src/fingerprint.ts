import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Filename of the staleness sentinel written into the `@gtkx/gi` store root. */
export const FINGERPRINT_FILENAME = ".codegen-fingerprint.json";

/**
 * The `@gtkx/codegen` package version, mixed into the store fingerprint so a
 * codegen upgrade invalidates a previously-generated store.
 */
export const CODEGEN_VERSION: string = (require("../package.json") as { version: string }).version;

/**
 * The staleness sentinel written into the generated `@gtkx/gi` store: the
 * fingerprint value plus the inputs that produced it, so a consumer can
 * recompute and compare without reloading the GIR repository.
 */
export type CodegenFingerprint = {
    /** The fingerprint hash of {@link CODEGEN_VERSION}, libraries, and GIR contents. */
    readonly value: string;
    /** Absolute paths of every loaded `.gir` file, in load order. */
    readonly girFiles: readonly string[];
    /** The resolved `Name-Version` library identifiers the store was built for. */
    readonly libraries: readonly string[];
};

/**
 * Computes a content fingerprint over the codegen version, the resolved library
 * set, and the contents of every loaded GIR file. A change to any of these
 * means the generated bindings are stale and must be regenerated.
 *
 * @param girFiles - Absolute paths of the loaded `.gir` files
 * @param libraries - The resolved `Name-Version` library identifiers
 */
export const computeFingerprint = (girFiles: readonly string[], libraries: readonly string[]): string => {
    const hash = createHash("sha256");
    hash.update(CODEGEN_VERSION);
    hash.update("\n");
    hash.update([...libraries].sort((a, b) => a.localeCompare(b)).join(","));
    for (const file of [...girFiles].sort((a, b) => a.localeCompare(b))) {
        hash.update("\n");
        hash.update(file);
        hash.update("\0");
        hash.update(readFileSync(file));
    }
    return hash.digest("hex");
};
