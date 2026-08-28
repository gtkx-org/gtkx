import { createHash, type Hash } from "node:crypto";
import { type Dirent, existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import packageManifest from "../package.json" with { type: "json" };
import { EXTERNAL_NAMESPACES } from "./gir/external-namespaces.js";
import { arrayGuard, hasFields, isNumber, isString, optionalGuard } from "./guards.js";
import { readJsonFile } from "./json.js";

type GiInputs = {
    girFiles: string[];
    libraries: string[];
    girPath: string[];
    storeVersion: string | undefined;
    isByteArrayTyped: boolean;
    isValueUnwrapped: boolean;
    isFinishTrimmed: boolean;
    isInoutInPlace: boolean;
    isTreeShaken: boolean;
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
    linkStyle: string;
    props: Record<string, ModuleExport>;
    omittedProps: Record<string, string[]>;
};

type DocsFingerprint = {
    value: string;
    gi: GiFingerprint;
};

type JsxFingerprintInput = {
    reactVersion: string;
    reactSubexports: string[];
    components: Record<string, ModuleExport>;
    lazyElements: string[];
    props: Record<string, ModuleExport>;
    omittedProps: Record<string, string[]>;
    isTreeShaken: boolean;
};

type JsxFingerprint = {
    value: string;
    intrinsicElementCount: number;
};

type InstalledManifest = { name: string; version: string };

const FINGERPRINT_FILENAME = ".codegen-fingerprint.json";
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OVERRIDES_ROOT = join(PACKAGE_ROOT, "overrides");
const requireFromCodegen = createRequire(import.meta.url);
const codegenHashCache: Map<string, string> = new Map();

const compareOrdinal = (a: string, b: string): number => {
    if (a < b) {
        return -1;
    }

    return a > b ? 1 : 0;
};

const sortOrdinal = (values: string[]): string[] => values.toSorted(compareOrdinal);
const sortAlpha = (values: string[]): string => sortOrdinal(values).join(",");

const filesUnder = (root: string): string[] => {
    if (!existsSync(root)) {
        return [];
    }

    return readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry: Dirent) => entry.isFile())
        .map((entry: Dirent) => join(entry.parentPath, entry.name));
};

const hashTree = (hash: Hash, label: string, root: string): void => {
    const files = sortOrdinal(filesUnder(root));

    for (const file of files) {
        hash.update("\n");
        hash.update(join(label, relative(root, file)));
        hash.update("\0");
        hash.update(readFileSync(file));
    }
};

const isInstalledManifest = (value: unknown): value is InstalledManifest =>
    hasFields<InstalledManifest>(value, { name: isString, version: isString });

const tryResolve = (specifier: string): string | undefined => {
    try {
        return requireFromCodegen.resolve(specifier);
    } catch {
        return undefined;
    }
};

const manifestVersion = (path: string | undefined, name: string): string | undefined => {
    if (path === undefined) {
        return undefined;
    }

    const manifest = readJsonFile(path);

    return isInstalledManifest(manifest) && manifest.name === name ? manifest.version : undefined;
};

const packageRootFor = (name: string): string | undefined => {
    const entry = tryResolve(name);

    if (entry === undefined) {
        return undefined;
    }

    for (let directory = dirname(entry); directory !== dirname(directory); directory = dirname(directory)) {
        if (manifestVersion(join(directory, "package.json"), name) !== undefined) {
            return directory;
        }
    }

    return undefined;
};

const installedVersion = (name: string): string | undefined => {
    const direct = manifestVersion(tryResolve(`${name}/package.json`), name);

    if (direct !== undefined) {
        return direct;
    }

    const root = packageRootFor(name);

    return root === undefined ? undefined : manifestVersion(join(root, "package.json"), name);
};

const dependencyVersions = (): string[] =>
    sortOrdinal(
        Object.entries(packageManifest.dependencies)
            .filter(([name]) => !name.startsWith("@types/"))
            .map(([name, range]) => `${name}@${installedVersion(name) ?? range}`),
    );

const hashPackageCode = (hash: Hash, label: string, root: string): void => {
    const source = join(root, "src");

    if (existsSync(source)) {
        hashTree(hash, join(label, "src"), source);

        return;
    }

    hashTree(hash, join(label, "dist"), join(root, "dist"));
};

const computeCodegenHash = (): string => {
    const hash = createHash("sha256");
    hash.update(dependencyVersions().join(","));
    hashPackageCode(hash, "codegen", PACKAGE_ROOT);
    hashTree(hash, "overrides", OVERRIDES_ROOT);
    const utilsRoot = packageRootFor("@gtkx/utils");

    if (utilsRoot !== undefined) {
        hashPackageCode(hash, "@gtkx/utils", utilsRoot);
    }

    return hash.digest("hex");
};

const codegenHash = (): string => {
    const cached = codegenHashCache.get("codegen");

    if (cached !== undefined) {
        return cached;
    }

    const value = computeCodegenHash();
    codegenHashCache.set("codegen", value);

    return value;
};

const hashGi = (inputs: GiInputs): string => {
    const hash = createHash("sha256");
    hash.update(codegenHash());
    hash.update("\n");
    hash.update(JSON.stringify(EXTERNAL_NAMESPACES));
    hash.update("\n");
    hash.update(sortAlpha(inputs.libraries));
    hash.update("\n");
    hash.update(sortAlpha(inputs.girPath));
    hash.update("\n");
    hash.update(String(inputs.isByteArrayTyped));
    hash.update("\n");
    hash.update(String(inputs.isValueUnwrapped));
    hash.update("\n");
    hash.update(String(inputs.isFinishTrimmed));
    hash.update("\n");
    hash.update(String(inputs.isInoutInPlace));
    hash.update("\n");
    hash.update(String(inputs.isTreeShaken));
    hash.update("\n");
    hash.update(String(inputs.storeVersion));
    const girFiles = sortOrdinal(inputs.girFiles);

    for (const file of girFiles) {
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
                input.linkStyle,
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
    sortOrdinal(Object.keys(map)).map((type) => [type, map[type]?.module ?? "", map[type]?.export ?? ""]);

const serializeOmittedProps = (map: Record<string, string[]>): [string, string][] =>
    sortOrdinal(Object.keys(map)).map((type) => [type, sortAlpha(map[type] ?? [])]);

const hashJsx = (input: JsxFingerprintInput): string =>
    createHash("sha256")
        .update(
            JSON.stringify([
                codegenHash(),
                input.reactVersion,
                sortOrdinal(input.reactSubexports),
                serializeModuleExports(input.components),
                sortOrdinal(input.lazyElements),
                serializeModuleExports(input.props),
                serializeOmittedProps(input.omittedProps),
                input.isTreeShaken,
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
