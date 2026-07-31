import type { JsxNamespaceFile } from "./jsx/pipeline.js";
import type { RawFile } from "./store-fs.js";
import { buildManifest, type StoreOptions, subpathExport, writeStore } from "./store-fs.js";

const writeJsxStore = (
    options: StoreOptions,
    namespaces: JsxNamespaceFile[],
    metadata: string,
    rawFiles: RawFile[],
): void => {
    const exportsMap: Record<string, unknown> = {
        "./metadata": subpathExport("metadata"),
    };

    const files = [{ fileName: "metadata.ts", source: metadata }];

    for (const { directory, source } of namespaces) {
        files.push({ fileName: `${directory}/${directory}.tsx`, source });
        exportsMap[`./${directory}`] = subpathExport(`${directory}/${directory}`);
    }

    writeStore({
        storeDir: options.storeDir,
        linkDir: options.linkDir,
        files,
        manifest: buildManifest({
            name: "@gtkx/jsx",
            version: options.version,
            exports: exportsMap,
            peerDependencies: { "@gtkx/gi": "*", "@gtkx/react": "*", react: "*" },
        }),
        rawFiles,
        configEnv: true,
    });
};

export { writeJsxStore };
