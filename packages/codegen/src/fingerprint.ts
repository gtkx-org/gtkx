import { sortStrings } from "@gtkx/utils";
import { createHash } from "node:crypto";
import { type Dirent, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import packageManifest from "../package.json" with { type: "json" };
import { arrayGuard, hasFields, isNumber, isString, optionalGuard } from "./guards.js";
import { readJsonFile } from "./json.js";

type GiFingerprint = {
    value: string;
    girFiles: string[];
    libraries: string[];
    girPath?: string[];
};

type ModuleExport = { module: string; export: string };

type DocsFingerprintInput = {
    basePath: string;
    props: Record<string, ModuleExport>;
    omittedProps: Record<string, string[]>;
};

type DocsFingerprint = {
    value: string;
    gi: GiFingerprint;
};

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

const FINGERPRINT_FILENAME = ".codegen-fingerprint.json";
const CODEGEN_VERSION: string = packageManifest.version;
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

const readSentinel = (storeDir: string): unknown => readJsonFile(join(storeDir, FINGERPRINT_FILENAME));

const isGiFingerprint = (value: unknown): value is GiFingerprint =>
    hasFields<GiFingerprint>(value, {
        value: isString,
        girFiles: arrayGuard(isString),
        libraries: arrayGuard(isString),
        girPath: optionalGuard(arrayGuard(isString)),
    });

const isDocsFingerprint = (value: unknown): value is DocsFingerprint =>
    hasFields<DocsFingerprint>(value, { value: isString, gi: isGiFingerprint });

const isJsxFingerprint = (value: unknown): value is JsxFingerprint =>
    hasFields<JsxFingerprint>(value, { value: isString, intrinsicElementCount: isNumber });

const recordedGiValue = (sentinel: GiFingerprint, libraries: string[], girPath: string[]): string | undefined => {
    if (!hasMatchingRecordedInputs(sentinel, libraries, girPath)) {
        return undefined;
    }

    try {
        return hashGi(sentinel.girFiles, sentinel.libraries, girPath);
    } catch {
        return undefined;
    }
};

const isGiStoreFresh = (
    giStoreDir: string,
    libraries: string[],
    girPath: string[],
): boolean => {
    const sentinel = readSentinel(giStoreDir);

    return isGiFingerprint(sentinel) && recordedGiValue(sentinel, libraries, girPath) === sentinel.value;
};

const hasMatchingRecordedInputs = (sentinel: GiFingerprint, libraries: string[], girPath: string[]): boolean =>
    sortAlpha(sentinel.libraries) === sortAlpha(libraries) && sortAlpha(sentinel.girPath ?? []) === sortAlpha(girPath);

const hashDocs = (giValue: string, input: DocsFingerprintInput): string =>
    createHash("sha256")
        .update(
            JSON.stringify([
                giValue,
                input.basePath,
                serializeModuleExports(input.props),
                serializeOmittedProps(input.omittedProps),
            ]),
        )
        .digest("hex");

const computeDocsFingerprint = (
    girFiles: string[],
    libraries: string[],
    girPath: string[],
    input: DocsFingerprintInput,
): DocsFingerprint => {
    const gi = computeGiFingerprint(girFiles, libraries, girPath);

    return { value: hashDocs(gi.value, input), gi };
};

const isDocsOutputFresh = (
    outDir: string,
    libraries: string[],
    girPath: string[],
    input: DocsFingerprintInput,
): boolean => {
    const sentinel = readSentinel(outDir);

    if (!isDocsFingerprint(sentinel)) {
        return false;
    }

    const giValue = recordedGiValue(sentinel.gi, libraries, girPath);

    return giValue !== undefined && hashDocs(giValue, input) === sentinel.value;
};

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
    const sentinel = readSentinel(jsxStoreDir);

    if (!isJsxFingerprint(sentinel)) {
        return { isFresh: false, intrinsicElementCount: 0 };
    }

    return sentinel.value === hashJsx(input)
        ? { isFresh: true, intrinsicElementCount: sentinel.intrinsicElementCount }
        : { isFresh: false, intrinsicElementCount: 0 };
};

export {
    FINGERPRINT_FILENAME,
    computeGiFingerprint,
    computeDocsFingerprint,
    isGiStoreFresh,
    isDocsOutputFresh,
    computeJsxFingerprint,
    jsxStoreFreshness,
    type DocsFingerprintInput,
    type GiFingerprint,
    type JsxFingerprintInput,
};
