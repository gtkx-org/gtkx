import type { ElementPropsExport, ModuleExport } from "@gtkx/config/elements";
import { createHash, type Hash } from "node:crypto";
import { type Dirent, existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import packageManifest from "../package.json" with { type: "json" };
import {
    hasFreshPropsDependencies,
    propsDependenciesSchema,
    type PropsDependencies,
} from "./docs/props-dependencies.js";
import { EXTERNAL_NAMESPACES } from "./gir/external-namespaces.js";
import { locateGirFile } from "./gir/libraries.js";
import { readJsonFile } from "./json.js";

type GiInputs = {
    girFiles: string[];
    libraries: string[];
    girPath: string[];
    storeVersion: string | undefined;
};

const giFingerprintSchema = z.object({
    value: z.string(),
    girFiles: z.array(z.string()),
    libraries: z.array(z.string()),
    girPath: z.array(z.string()),
});

type GiFingerprint = z.infer<typeof giFingerprintSchema>;

type DocsFingerprintInput = {
    resolveFrom: string;
    basePath: string;
    linkStyle: string;
    props: Record<string, ElementPropsExport>;
    omittedProps: Record<string, string[]>;
    acceptedChildTypes: Record<string, string[]>;
};

const docsFingerprintSchema = z.object({
    value: z.string(),
    gi: giFingerprintSchema,
    props: propsDependenciesSchema,
});

type DocsFingerprint = z.infer<typeof docsFingerprintSchema>;

type JsxFingerprintInput = {
    reactVersion: string;
    components: Record<string, ModuleExport>;
    lazyElements: string[];
    props: Record<string, ElementPropsExport>;
    omittedProps: Record<string, string[]>;
};

const jsxFingerprintSchema = z.object({
    value: z.string(),
    intrinsicElementCount: z.number(),
});

type JsxFingerprint = z.infer<typeof jsxFingerprintSchema>;

const installedManifestSchema = z.object({ name: z.string(), version: z.string() });

const FINGERPRINT_FILENAME = ".codegen-fingerprint.json";
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OVERRIDES_ROOT = join(PACKAGE_ROOT, "overrides");
const codegenHashCache: { value: string | undefined } = { value: undefined };

const sortAlpha = (values: string[]): string => values.toSorted().join(",");

const filesUnder = (root: string): string[] => {
    if (!existsSync(root)) {
        return [];
    }

    return readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry: Dirent) => entry.isFile())
        .map((entry: Dirent) => join(entry.parentPath, entry.name));
};

const hashTree = (hash: Hash, label: string, root: string): void => {
    const files = filesUnder(root).toSorted();

    for (const file of files) {
        hash.update("\n");
        hash.update(join(label, relative(root, file)));
        hash.update("\0");
        hash.update(readFileSync(file));
    }
};

const tryResolve = (specifier: string): string | undefined => {
    try {
        return fileURLToPath(import.meta.resolve(specifier));
    } catch {
        return undefined;
    }
};

const manifestVersion = (path: string | undefined, name: string): string | undefined => {
    if (path === undefined) {
        return undefined;
    }

    const manifest = installedManifestSchema.safeParse(readJsonFile(path));

    return manifest.success && manifest.data.name === name ? manifest.data.version : undefined;
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
    Object.entries(packageManifest.dependencies)
        .filter(([name]) => !name.startsWith("@types/"))
        .map(([name, range]) => `${name}@${installedVersion(name) ?? range}`)
        .toSorted();

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

const codegenHash = (): string => (codegenHashCache.value ??= computeCodegenHash());

const hashGi = (inputs: GiInputs): string => {
    const hash = createHash("sha256");
    hash.update(codegenHash());
    hash.update("\n");
    hash.update(JSON.stringify(EXTERNAL_NAMESPACES));
    hash.update("\n");
    hash.update(JSON.stringify(inputs.libraries));
    hash.update("\n");
    hash.update(JSON.stringify(inputs.girPath));
    hash.update("\n");
    hash.update(String(inputs.storeVersion));
    const girFiles = inputs.girFiles.toSorted();

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

const recordedGiValue = (sentinel: GiFingerprint, inputs: GiInputs): string | undefined => {
    if (!hasMatchingRecordedInputs(sentinel, inputs)) {
        return undefined;
    }

    try {
        const girFiles = sentinel.girFiles.map((file) => locateGirFile(basename(file, ".gir"), inputs.girPath));

        return hashGi({ ...inputs, girFiles });
    } catch {
        return undefined;
    }
};

const isGiStoreFresh = (giStoreDir: string, inputs: GiInputs): boolean => {
    const sentinel = giFingerprintSchema.safeParse(readSentinel(giStoreDir));

    return sentinel.success && isGiFingerprintFresh(sentinel.data, inputs);
};

const isGiFingerprintFresh = (fingerprint: GiFingerprint, inputs: GiInputs): boolean =>
    recordedGiValue(fingerprint, inputs) === fingerprint.value;

const hasMatchingRecordedInputs = (sentinel: GiFingerprint, inputs: GiInputs): boolean =>
    JSON.stringify(sentinel.libraries) === JSON.stringify(inputs.libraries) &&
    JSON.stringify(sentinel.girPath) === JSON.stringify(inputs.girPath);

const hashDocs = (giValue: string, input: DocsFingerprintInput, propsValue: string): string =>
    createHash("sha256")
        .update(
            JSON.stringify([
                giValue,
                input.resolveFrom,
                propsValue,
                input.basePath,
                input.linkStyle,
                serializeElementProps(input.props),
                serializeStringLists(input.omittedProps),
                serializeStringLists(input.acceptedChildTypes),
            ]),
        )
        .digest("hex");

const computeDocsFingerprint = (
    inputs: GiInputs,
    input: DocsFingerprintInput,
    props: PropsDependencies,
): DocsFingerprint => {
    const gi = computeGiFingerprint(inputs);

    return { value: hashDocs(gi.value, input, props.value), gi, props };
};

const isDocsOutputFresh = (outDir: string, inputs: GiInputs, input: DocsFingerprintInput): boolean => {
    const parsed = docsFingerprintSchema.safeParse(readSentinel(outDir));

    if (!parsed.success) {
        return false;
    }

    const sentinel = parsed.data;
    const giValue = recordedGiValue(sentinel.gi, inputs);

    return (
        giValue !== undefined &&
        hashDocs(giValue, input, sentinel.props.value) === sentinel.value &&
        hasFreshPropsDependencies(sentinel.props)
    );
};

const serializeModuleExports = (map: Record<string, ModuleExport>): [string, string, string][] =>
    Object.keys(map)
        .toSorted()
        .map((type) => [type, map[type]?.module ?? "", map[type]?.export ?? ""]);

const serializeElementProps = (map: Record<string, ElementPropsExport>): [string, string, string, string, string][] =>
    Object.keys(map)
        .toSorted()
        .map((type) => [
            type,
            map[type]?.module ?? "",
            map[type]?.export ?? "",
            map[type]?.composition ?? "",
            sortAlpha(map[type]?.constructOnly ?? []),
        ]);

const serializeStringLists = (map: Record<string, string[]>): [string, string][] =>
    Object.keys(map)
        .toSorted()
        .map((type) => [type, sortAlpha(map[type] ?? [])]);

const hashJsx = (input: JsxFingerprintInput): string =>
    createHash("sha256")
        .update(
            JSON.stringify([
                codegenHash(),
                input.reactVersion,
                serializeModuleExports(input.components),
                input.lazyElements.toSorted(),
                serializeElementProps(input.props),
                serializeStringLists(input.omittedProps),
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
    const parsed = jsxFingerprintSchema.safeParse(readSentinel(jsxStoreDir));

    if (!parsed.success) {
        return { isFresh: false, intrinsicElementCount: 0 };
    }

    const sentinel = parsed.data;
    return sentinel.value === hashJsx(input)
        ? { isFresh: true, intrinsicElementCount: sentinel.intrinsicElementCount }
        : { isFresh: false, intrinsicElementCount: 0 };
};

export {
    FINGERPRINT_FILENAME,
    computeGiFingerprint,
    computeDocsFingerprint,
    isGiStoreFresh,
    isGiFingerprintFresh,
    isDocsOutputFresh,
    computeJsxFingerprint,
    jsxStoreFreshness,
    type DocsFingerprintInput,
    type GiInputs,
    type GiFingerprint,
    type JsxFingerprintInput,
};
