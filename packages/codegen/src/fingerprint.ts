import { sortStrings } from "@gtkx/utils";
import { createHash } from "node:crypto";
import { type Dirent, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import packageManifest from "../package.json" with { type: "json" };
import { arrayGuard, hasFields, isNumber, isString, optionalGuard } from "./guards.js";
import { readJsonFile } from "./json.js";

type GiInputs = {
    girFiles: string[];
    libraries: string[];
    girPath: string[];
    isByteArrayTyped: boolean;
};

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

const hashGi = (inputs: GiInputs): string => {
    const hash = createHash("sha256");
    hash.update(CODEGEN_VERSION);
    hash.update("\n");
    hash.update(sortAlpha(inputs.libraries));
    hash.update("\n");
    hash.update(sortAlpha(inputs.girPath));
    hash.update("\n");
    hash.update(String(inputs.isByteArrayTyped));
    hash.update("\n");
    const hashedFiles = sortStrings([...inputs.girFiles, ...overrideFiles()]);

    for (const file of hashedFiles) {
        hash.update("\n");
        hash.update(file);
        hash.update("\0");
        hash.update(readFileSync(file));
    }

    return hash.digest("hex");
};

const computeGiFingerprint = (inputs: GiInputs): GiFingerprint => ({
    value: hashGi(inputs),
    girFiles: inputs.girFiles,
    libraries: inputs.libraries,
    girPath: inputs.girPath,
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

const recordedGiValue = (sentinel: GiFingerprint, inputs: GiInputs): string | undefined => {
    if (!hasMatchingRecordedInputs(sentinel, inputs)) {
        return undefined;
    }

    try {
        return hashGi({ ...inputs, girFiles: sentinel.girFiles, libraries: sentinel.libraries });
    } catch {
        return undefined;
    }
};

const isGiStoreFresh = (giStoreDir: string, inputs: GiInputs): boolean => {
    const sentinel = readSentinel(giStoreDir);

    return isGiFingerprint(sentinel) && recordedGiValue(sentinel, inputs) === sentinel.value;
};

const hasMatchingRecordedInputs = (sentinel: GiFingerprint, inputs: GiInputs): boolean =>
    sortAlpha(sentinel.libraries) === sortAlpha(inputs.libraries) &&
    sortAlpha(sentinel.girPath ?? []) === sortAlpha(inputs.girPath);

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

const computeDocsFingerprint = (inputs: GiInputs, input: DocsFingerprintInput): DocsFingerprint => {
    const gi = computeGiFingerprint(inputs);

    return { value: hashDocs(gi.value, input), gi };
};

const isDocsOutputFresh = (outDir: string, inputs: GiInputs, input: DocsFingerprintInput): boolean => {
    const sentinel = readSentinel(outDir);

    if (!isDocsFingerprint(sentinel)) {
        return false;
    }

    const giValue = recordedGiValue(sentinel.gi, inputs);

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
    type GiInputs,
    type GiFingerprint,
    type JsxFingerprintInput,
};
