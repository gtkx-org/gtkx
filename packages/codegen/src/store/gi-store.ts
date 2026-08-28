import { sortStrings } from "@gtkx/utils";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SourceModule } from "../compile.js";
import { FINGERPRINT_FILENAME, type GiFingerprint } from "../fingerprint.js";
import {
    type GeneratedLibraries,
    LIBRARIES_FILENAME,
    renderGeneratedLibraries,
} from "./gi/generated-libraries.js";
import { buildManifest, namespaceBarrel, type StoreOptions, subpathExport, writeStore } from "./store-fs.js";

type GiNamespaceInput = {
    directory: string;
    rawSource: string;
    rawBootstrapSource?: string | undefined;
    girFile: string;
};

type GiExternalNamespaceInput = {
    directory: string;
    packageName: string;
    girFile: string;
};

type GiStoreRecords = {
    fingerprint: GiFingerprint;
    libraries: GeneratedLibraries;
};

const OVERRIDES_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "overrides");
const TREE_SHAKEN_SIDE_EFFECTS = ["**/bootstrap.js", "**/overrides/*.js", "**/index.js"];

const overrideFiles = (directory: string): SourceModule[] => {
    const dir = join(OVERRIDES_ROOT, directory);

    if (!existsSync(dir)) {
        return [];
    }

    return readdirSync(dir)
        .filter((name) => name.endsWith(".ejs") && name !== "index.ts.ejs")
        .map((name) => overrideModule(`${directory}/overrides/${name.replace(/\.ejs$/, "")}`, join(dir, name)));
};

const overrideModule = (fileName: string, overridePath: string): SourceModule => ({
    fileName,
    source: readFileSync(overridePath, "utf8"),
    origin: overridePath,
});

const barrelFile = (directory: string, girFile: string, hasBootstrap: boolean): SourceModule => {
    const barrel = namespaceBarrel(directory);
    const overrideIndex = join(OVERRIDES_ROOT, directory, "index.ts.ejs");

    const file = existsSync(overrideIndex)
        ? overrideModule(barrel.fileName, overrideIndex)
        : { ...barrel, origin: girFile };

    if (!hasBootstrap) {
        return file;
    }

    return { ...file, source: `import "./bootstrap.js";\n${file.source}` };
};

const externalShimModule = ({ directory, packageName, girFile }: GiExternalNamespaceInput): SourceModule => ({
    fileName: `${directory}/index.ts`,
    source:
        `/** @deprecated Since 1.3. Import from "${packageName}" instead. Removed in v2. */\n` +
        `export * from "${packageName}";\n`,
    origin: girFile,
});

const collectStoreSources = (
    namespaces: GiNamespaceInput[],
    externalNamespaces: GiExternalNamespaceInput[],
): { collected: SourceModule[]; exportsMap: Record<string, unknown> } => {
    const exportsMap: Record<string, unknown> = {};
    const collected: SourceModule[] = [];

    for (const { directory, rawSource, rawBootstrapSource, girFile } of namespaces) {
        collected.push(
            { fileName: `${directory}/${directory}.ts`, source: rawSource, origin: girFile },
            ...overrideFiles(directory),
            barrelFile(directory, girFile, rawBootstrapSource !== undefined),
        );

        if (rawBootstrapSource !== undefined) {
            collected.push({ fileName: `${directory}/bootstrap.ts`, source: rawBootstrapSource, origin: girFile });
        }

        exportsMap[`./${directory}`] = subpathExport(`${directory}/index`);
    }

    for (const external of externalNamespaces) {
        collected.push(externalShimModule(external));
        exportsMap[`./${external.directory}`] = subpathExport(`${external.directory}/index`);
    }

    return { collected, exportsMap };
};

const storePeerDependencies = (externalNamespaces: GiExternalNamespaceInput[]): Record<string, string> =>
    Object.fromEntries(
        sortStrings(["@gtkx/runtime", ...externalNamespaces.map((entry) => entry.packageName)]).map((name) => [
            name,
            "*",
        ]),
    );

const writeGiStore = (
    options: StoreOptions,
    namespaces: GiNamespaceInput[],
    externalNamespaces: GiExternalNamespaceInput[],
    records: GiStoreRecords,
): void => {
    const { collected, exportsMap } = collectStoreSources(namespaces, externalNamespaces);
    const isTreeShaken = namespaces.some((namespace) => namespace.rawBootstrapSource !== undefined);

    writeStore({
        storeDir: options.storeDir,
        linkDir: options.linkDir,
        files: collected,
        manifest: buildManifest({
            name: "@gtkx/gi",
            version: options.version,
            exports: exportsMap,
            sideEffects: isTreeShaken ? TREE_SHAKEN_SIDE_EFFECTS : true,
            peerDependencies: storePeerDependencies(externalNamespaces),
        }),
        rawFiles: [
            { relativePath: FINGERPRINT_FILENAME, content: `${JSON.stringify(records.fingerprint, null, 2)}\n` },
            { relativePath: LIBRARIES_FILENAME, content: renderGeneratedLibraries(records.libraries) },
        ],
    });
};

export { writeGiStore, type GiExternalNamespaceInput, type GiNamespaceInput };
