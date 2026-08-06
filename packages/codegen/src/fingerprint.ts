import { sortStrings } from "@gtkx/utils";
import { createHash } from "node:crypto";
import { type Dirent, existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type GiFingerprint = {
    value: string;
    girFiles: string[];
    libraries: string[];
    girPath?: string[];
};

type ModuleExport = { module: string; export: string };

type JsxFingerprintInput = {
    reactVersion: string;
    components: Record<string, ModuleExport>;
    lazyElements: string[];
    props: Record<string, ModuleExport>;
    omittedProps: Record<string, string[]>;
};

type JsxFingerprint = {
    value: string;
    intrinsicElementCount: number;
};

const require = createRequire(import.meta.url);
const FINGERPRINT_FILENAME = ".codegen-fingerprint.json";
const CODEGEN_VERSION: string = (require("../package.json") as { version: string }).version;
const OVERRIDES_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "overrides");

const sortAlpha = (values: string[]): string => sortStrings(values).join(",");

const overrideFiles = (): string[] => {
    if (!existsSync(OVERRIDES_ROOT)) {
        return [];
    }

    return readdirSync(OVERRIDES_ROOT, { recursive: true, withFileTypes: true })
        .filter((entry: Dirent) => entry.isFile())
        .map((entry: Dirent) => join(entry.parentPath, entry.name));
};

const hashGi = (girFiles: string[], libraries: string[], girPath: string[]): string => {
    const hash = createHash("sha256");
    hash.update(CODEGEN_VERSION);
    hash.update("\n");
    hash.update(sortAlpha(libraries));
    hash.update("\n");
    hash.update(sortAlpha(girPath));
    hash.update("\n");
    const hashedFiles = sortStrings([...girFiles, ...overrideFiles()]);

    for (const file of hashedFiles) {
        hash.update("\n");
        hash.update(file);
        hash.update("\0");
        hash.update(readFileSync(file));
    }

    return hash.digest("hex");
};

const computeGiFingerprint = (
    girFiles: string[],
    libraries: string[],
    girPath: string[],
): GiFingerprint => ({
    value: hashGi(girFiles, libraries, girPath),
    girFiles,
    libraries,
    girPath,
});

const isGiStoreFresh = (
    giStoreDir: string,
    libraries: string[],
    girPath: string[],
): boolean => {
    const sentinelPath = join(giStoreDir, FINGERPRINT_FILENAME);

    if (!existsSync(sentinelPath)) {
        return false;
    }

    let sentinel: GiFingerprint;

    try {
        sentinel = JSON.parse(readFileSync(sentinelPath, "utf8")) as GiFingerprint;
    } catch {
        return false;
    }

    if (!hasMatchingRecordedInputs(sentinel, libraries, girPath)) {
        return false;
    }

    try {
        return hashGi(sentinel.girFiles, sentinel.libraries, girPath) === sentinel.value;
    } catch {
        return false;
    }
};

const hasMatchingRecordedInputs = (sentinel: GiFingerprint, libraries: string[], girPath: string[]): boolean =>
    sortAlpha(sentinel.libraries) === sortAlpha(libraries) && sortAlpha(sentinel.girPath ?? []) === sortAlpha(girPath);

const serializeModuleExports = (map: Record<string, ModuleExport>): [string, string, string][] =>
    sortStrings(Object.keys(map)).map((type) => [type, map[type]?.module ?? "", map[type]?.export ?? ""]);

const serializeOmittedProps = (map: Record<string, string[]>): [string, string][] =>
    sortStrings(Object.keys(map)).map((type) => [type, sortAlpha(map[type] ?? [])]);

const hashJsx = (input: JsxFingerprintInput): string =>
    createHash("sha256")
        .update(
            JSON.stringify([
                CODEGEN_VERSION,
                input.reactVersion,
                serializeModuleExports(input.components),
                sortStrings(input.lazyElements),
                serializeModuleExports(input.props),
                serializeOmittedProps(input.omittedProps),
            ]),
        )
        .digest("hex");

const computeJsxFingerprint = (input: JsxFingerprintInput, intrinsicElementCount: number): JsxFingerprint => ({
    value: hashJsx(input),
    intrinsicElementCount,
});

const jsxStoreFreshness = (
    jsxStoreDir: string,
    input: JsxFingerprintInput,
): { isFresh: boolean; intrinsicElementCount: number } => {
    const sentinelPath = join(jsxStoreDir, FINGERPRINT_FILENAME);

    if (!existsSync(sentinelPath)) {
        return { isFresh: false, intrinsicElementCount: 0 };
    }

    let sentinel: JsxFingerprint;

    try {
        sentinel = JSON.parse(readFileSync(sentinelPath, "utf8")) as JsxFingerprint;
    } catch {
        return { isFresh: false, intrinsicElementCount: 0 };
    }

    return sentinel.value === hashJsx(input)
        ? { isFresh: true, intrinsicElementCount: sentinel.intrinsicElementCount }
        : { isFresh: false, intrinsicElementCount: 0 };
};

export {
    FINGERPRINT_FILENAME,
    computeGiFingerprint,
    isGiStoreFresh,
    computeJsxFingerprint,
    jsxStoreFreshness,
    type GiFingerprint,
    type JsxFingerprintInput,
};
