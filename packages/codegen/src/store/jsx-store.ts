import type { JsxNamespaceFile } from "./react/pipeline.js";
import { buildManifest, type StoreOptions, subpathExport, writeStore } from "./store-fs.js";

export type JsxStoreOptions = StoreOptions;

export const writeJsxStore = (options: JsxStoreOptions, namespaces: JsxNamespaceFile[], metadata: string): void => {
    const exportsMap: Record<string, unknown> = {
        "./metadata": subpathExport("metadata"),
    };
    const files = [{ stem: "metadata", fileName: "metadata.ts", source: metadata }];
    for (const { directory, source } of namespaces) {
        files.push({ stem: `${directory}/${directory}`, fileName: `${directory}/${directory}.tsx`, source });
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
    });
};
