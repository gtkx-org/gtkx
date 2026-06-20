import type { JsxNamespaceFile } from "./react/pipeline.js";
import { type StoreOptions, subpathExport, writeStore } from "./store-fs.js";

export type JsxStoreOptions = StoreOptions & {
    giStoreDir: string;
    realReactRuntimeDir: string;
    realReactPackageDir: string;
};

export const writeJsxStore = (options: JsxStoreOptions, namespaces: JsxNamespaceFile[], metadata: string): void => {
    const exportsMap: Record<string, unknown> = {
        "./package.json": "./package.json",
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
        manifest: {
            name: "@gtkx/jsx",
            type: "module",
            version: options.version,
            sideEffects: true,
            exports: exportsMap,
        },
        symlinks: [
            { segments: ["node_modules", "@gtkx", "gi"], target: options.giStoreDir },
            { segments: ["node_modules", "@gtkx", "react"], target: options.realReactPackageDir },
            { segments: ["node_modules", "@gtkx", "jsx"], target: "self" },
            { segments: ["node_modules", "react"], target: options.realReactRuntimeDir },
        ],
    });
};
