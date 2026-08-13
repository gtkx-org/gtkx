import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SourceModule } from "../compile.js";
import { FINGERPRINT_FILENAME, type GiFingerprint } from "../fingerprint.js";
import { buildManifest, namespaceBarrel, type StoreOptions, subpathExport, writeStore } from "./store-fs.js";

type GiNamespaceInput = {
    directory: string;
    rawSource: string;
    girFile: string;
};

const OVERRIDES_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "overrides");

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

    if (!existsSync(overrideIndex)) {
        return { ...barrel, origin: girFile };
    }

    return overrideModule(barrel.fileName, overrideIndex);
};

const collectStoreSources = (
    namespaces: GiNamespaceInput[],
): { collected: SourceModule[]; exportsMap: Record<string, unknown> } => {
    const exportsMap: Record<string, unknown> = {};
    const collected: SourceModule[] = [];

    for (const { directory, rawSource, girFile } of namespaces) {
        collected.push(
            { fileName: `${directory}/${directory}.ts`, source: rawSource, origin: girFile },
            ...overrideFiles(directory),
            barrelFile(directory, girFile),
        );

        exportsMap[`./${directory}`] = subpathExport(`${directory}/index`);
    }

    return { collected, exportsMap };
};

const writeGiStore = (
    options: StoreOptions,
    namespaces: GiNamespaceInput[],
    fingerprint: GiFingerprint,
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
            peerDependencies: { "@gtkx/runtime": "*" },
        }),
        rawFiles: [{ relativePath: FINGERPRINT_FILENAME, content: `${JSON.stringify(fingerprint, null, 2)}\n` }],
    });
};

export { writeGiStore, type GiNamespaceInput };
