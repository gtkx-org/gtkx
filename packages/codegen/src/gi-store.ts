import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type CodegenFingerprint, FINGERPRINT_FILENAME } from "./fingerprint.js";
import { buildManifest, type StoreOptions, selfLink, subpathExport, writeStore } from "./store-fs.js";

const TEMPLATE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src", "templates");

export type GiStoreOptions = StoreOptions & {
    realFfiDir: string;
    realNativeDir: string;
};

export type GiNamespaceInput = {
    directory: string;
    rawSource: string;
};

const templateFiles = (directory: string): string[] => {
    const dir = join(TEMPLATE_ROOT, directory);
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((name) => name.endsWith(".ts") && name !== "index.ts");
};

const barrelSource = (directory: string): string => {
    const template = join(TEMPLATE_ROOT, directory, "index.ts");
    if (!existsSync(template)) {
        return `export * from "./${directory}.js";\n`;
    }
    return readFileSync(template, "utf8");
};

type CollectedFile = {
    stem: string;
    fileName: string;
    source: string;
};

const collectStoreSources = (
    namespaces: GiNamespaceInput[],
): { collected: CollectedFile[]; exportsMap: Record<string, unknown> } => {
    const exportsMap: Record<string, unknown> = {};
    const collected: CollectedFile[] = [];
    for (const { directory, rawSource } of namespaces) {
        collected.push({
            stem: `${directory}/${directory}`,
            fileName: `${directory}/${directory}.ts`,
            source: rawSource,
        });
        for (const file of templateFiles(directory)) {
            collected.push({
                stem: `${directory}/overrides/${file.slice(0, -".ts".length)}`,
                fileName: `${directory}/overrides/${file}`,
                source: readFileSync(join(TEMPLATE_ROOT, directory, file), "utf8"),
            });
        }
        collected.push({
            stem: `${directory}/index`,
            fileName: `${directory}/index.ts`,
            source: barrelSource(directory),
        });
        exportsMap[`./${directory}`] = subpathExport(`${directory}/index`);
    }
    return { collected, exportsMap };
};

export const writeGiStore = (
    options: GiStoreOptions,
    namespaces: GiNamespaceInput[],
    fingerprint: CodegenFingerprint,
): void => {
    const { collected, exportsMap } = collectStoreSources(namespaces);

    writeStore({
        storeDir: options.storeDir,
        linkDir: options.linkDir,
        files: collected,
        manifest: buildManifest({ name: "@gtkx/gi", version: options.version, exports: exportsMap }),
        rawFiles: [{ relativePath: FINGERPRINT_FILENAME, content: `${JSON.stringify(fingerprint, null, 2)}\n` }],
        symlinks: [
            { segments: ["node_modules", "@gtkx", "ffi"], target: options.realFfiDir },
            { segments: ["node_modules", "@gtkx", "native"], target: options.realNativeDir },
            selfLink("node_modules", "@gtkx", "gi"),
        ],
    });
};
