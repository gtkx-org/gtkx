import { sortStrings } from "@gtkx/utils";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SourceModule } from "../compile.js";
import { FINGERPRINT_FILENAME, type GiFingerprint } from "../fingerprint.js";
import {
    type GeneratedLibraryInventory,
    LIBRARIES_FILENAME,
    renderGeneratedLibraries,
} from "./gi/generated-libraries.js";
import { buildManifest, namespaceBarrel, type StoreOptions, subpathExport, writeStore } from "./store-fs.js";

type GiNamespaceInput = {
    directory: string;
    rawSource: string;
    rawBootstrapSource: string;
    girFile: string;
};

type GiStoreRecords = {
    fingerprint: GiFingerprint;
    libraries: GeneratedLibraryInventory;
};

const OVERRIDES_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "overrides");
const STORE_SIDE_EFFECTS = ["**/bootstrap.js", "**/overrides/*.js", "**/index.js"];

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

const barrelFile = (directory: string, girFile: string): SourceModule => {
    const barrel = namespaceBarrel(directory);
    const overrideIndex = join(OVERRIDES_ROOT, directory, "index.ts.ejs");

    const file = existsSync(overrideIndex)
        ? overrideModule(barrel.fileName, overrideIndex)
        : { ...barrel, origin: girFile };

    return { ...file, source: `import "./bootstrap.js";\n${file.source}` };
};

const collectStoreSources = (
    namespaces: GiNamespaceInput[],
): { collected: SourceModule[]; exportsMap: Record<string, unknown> } => {
    const exportsMap: Record<string, unknown> = {};
    const collected: SourceModule[] = [];

    for (const { directory, rawSource, rawBootstrapSource, girFile } of namespaces) {
        collected.push(
            { fileName: `${directory}/${directory}.ts`, source: rawSource, origin: girFile },
            ...overrideFiles(directory),
            barrelFile(directory, girFile),
            { fileName: `${directory}/bootstrap.ts`, source: rawBootstrapSource, origin: girFile },
        );

        exportsMap[`./${directory}`] = subpathExport(`${directory}/index`);
    }

    return { collected, exportsMap };
};

const storePeerDependencies = (externalPackages: string[]): Record<string, string> =>
    Object.fromEntries(
        sortStrings(["@gtkx/runtime", ...externalPackages]).map((name) => [name, "*"]),
    );

const writeGiStore = (
    options: StoreOptions,
    namespaces: GiNamespaceInput[],
    externalPackages: string[],
    records: GiStoreRecords,
): void => {
    const { collected, exportsMap } = collectStoreSources(namespaces);

    writeStore({
        storeDir: options.storeDir,
        linkDir: options.linkDir,
        files: collected,
        manifest: buildManifest({
            name: "@gtkx/gi",
            version: options.version,
            exports: exportsMap,
            sideEffects: STORE_SIDE_EFFECTS,
            peerDependencies: storePeerDependencies(externalPackages),
        }),
        rawFiles: [
            { relativePath: FINGERPRINT_FILENAME, content: `${JSON.stringify(records.fingerprint, null, 2)}\n` },
            { relativePath: LIBRARIES_FILENAME, content: renderGeneratedLibraries(records.libraries) },
        ],
    });
};

export { writeGiStore, type GiNamespaceInput };
