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

const stableValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stableValue);
    if (typeof value !== "object" || value === null) return value;
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort((a, b) => a.localeCompare(b))) {
        sorted[key] = stableValue(record[key]);
    }
    return sorted;
};

/**
 * The `gtkx.config.ts` inputs that shape the generated output beyond the GIR
 * contents: the table rows baked into `@gtkx/jsx/metadata` and the slot maps
 * shaping the Props surfaces.
 */
export type UserTableInputs = {
    /** The config's `slots` map, or `undefined`. */
    readonly slots?: Readonly<Record<string, readonly string[]>>;
    /** The config's `containerSlots` map, or `undefined`. */
    readonly containerSlots?: Readonly<Record<string, readonly string[]>>;
    /** The config's `arrayProps` rows, or `undefined`. */
    readonly arrayProps?: unknown;
    /** The config's `elementMap` rows, or `undefined`. */
    readonly elementMap?: unknown;
};

/**
 * Serializes the table-shaping config inputs into the canonical string mixed
 * into the store fingerprint, with object keys sorted recursively so the
 * serialization is independent of declaration order.
 *
 * @param tables - The table-shaping fields of the loaded config
 */
export const serializeUserTables = (tables: UserTableInputs): string =>
    JSON.stringify(
        stableValue({
            slots: tables.slots ?? {},
            containerSlots: tables.containerSlots ?? {},
            arrayProps: tables.arrayProps ?? {},
            elementMap: tables.elementMap ?? [],
        }),
    );

/**
 * Computes a content fingerprint over the codegen version, the resolved library
 * set, the table-shaping config inputs, and the contents of every loaded GIR
 * file. A change to any of these means the generated bindings are stale and
 * must be regenerated.
 *
 * @param girFiles - Absolute paths of the loaded `.gir` files
 * @param libraries - The resolved `Name-Version` library identifiers
 * @param userTables - The {@link serializeUserTables} serialization of the config's tables
 */
export const computeFingerprint = (
    girFiles: readonly string[],
    libraries: readonly string[],
    userTables: string,
): string => {
    const hash = createHash("sha256");
    hash.update(CODEGEN_VERSION);
    hash.update("\n");
    hash.update([...libraries].sort((a, b) => a.localeCompare(b)).join(","));
    hash.update("\n");
    hash.update(userTables);
    for (const file of [...girFiles].sort((a, b) => a.localeCompare(b))) {
        hash.update("\n");
        hash.update(file);
        hash.update("\0");
        hash.update(readFileSync(file));
    }
    return hash.digest("hex");
};
