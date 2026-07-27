import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FINGERPRINT_FILENAME, type GiFingerprint } from "../fingerprint.js";
import { buildManifest, type StoreOptions, subpathExport, writeStore } from "./store-fs.js";

type GiStoreOptions = StoreOptions;

type GiNamespaceInput = {
    directory: string;
    rawSource: string;
};

type CollectedFile = {
    fileName: string;
    source: string;
};

const OVERRIDES_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "overrides");

const overrideFiles = (directory: string): string[] => {
    const dir = join(OVERRIDES_ROOT, directory);

    if (!existsSync(dir)) {
        return [];
    }

    return readdirSync(dir).filter((name) => name.endsWith(".ejs") && name !== "index.ts.ejs");
};

const barrelSource = (directory: string): string => {
    const overrideIndex = join(OVERRIDES_ROOT, directory, "index.ts.ejs");

    if (!existsSync(overrideIndex)) {
        return `export * from "./${directory}.js";\n`;
    }

    return readFileSync(overrideIndex, "utf8");
};

const collectStoreSources = (
    namespaces: GiNamespaceInput[],
): { collected: CollectedFile[]; exportsMap: Record<string, unknown> } => {
    const exportsMap: Record<string, unknown> = {};
    const collected: CollectedFile[] = [];

    for (const { directory, rawSource } of namespaces) {
        collected.push({
            fileName: `${directory}/${directory}.ts`,
            source: rawSource,
        });

        for (const file of overrideFiles(directory)) {
            collected.push({
                fileName: `${directory}/overrides/${file.replace(/\.ejs$/, "")}`,
                source: readFileSync(join(OVERRIDES_ROOT, directory, file), "utf8"),
            });
        }

        collected.push({
            fileName: `${directory}/index.ts`,
            source: barrelSource(directory),
        });

        exportsMap[`./${directory}`] = subpathExport(`${directory}/index`);
    }

    return { collected, exportsMap };
};

const writeGiStore = (
    options: GiStoreOptions,
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

export { writeGiStore, type GiStoreOptions, type GiNamespaceInput };
