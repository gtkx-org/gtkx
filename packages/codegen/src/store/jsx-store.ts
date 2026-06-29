import type { JsxNamespaceFile } from "./react/pipeline.js";
import { buildManifest, type StoreOptions, selfLink, subpathExport, writeStore } from "./store-fs.js";

export type JsxStoreOptions = StoreOptions & {
    giStoreDir: string;
    realReactRuntimeDir: string;
    realReactPackageDir: string;
};

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
        manifest: buildManifest({ name: "@gtkx/jsx", version: options.version, exports: exportsMap }),
        symlinks: [
            { segments: ["node_modules", "@gtkx", "gi"], target: options.giStoreDir },
            { segments: ["node_modules", "@gtkx", "react"], target: options.realReactPackageDir },
            selfLink("node_modules", "@gtkx", "jsx"),
            { segments: ["node_modules", "react"], target: options.realReactRuntimeDir },
        ],
    });
};
