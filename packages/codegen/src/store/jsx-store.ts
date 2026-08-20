import { sortStrings } from "@gtkx/utils";
import type { JsxNamespaceFile } from "./jsx/pipeline.js";
import type { RawFile } from "./store-fs.js";
import { buildManifest, namespaceBarrel, type StoreOptions, subpathExport, writeStore } from "./store-fs.js";

type WriteJsxStoreParams = {
    options: StoreOptions;
    namespaces: JsxNamespaceFile[];
    metadata: string;
    externalPackages: string[];
    rawFiles: RawFile[];
};

const jsxPeerDependencies = (externalPackages: string[]): Record<string, string> =>
    Object.fromEntries(
        sortStrings(["@gtkx/gi", "@gtkx/react", "react", ...externalPackages]).map((name) => [name, "*"]),
    );

const writeJsxStore = (params: WriteJsxStoreParams): void => {
    const { options, namespaces, metadata, externalPackages, rawFiles } = params;

    const exportsMap: Record<string, unknown> = {
        ".": subpathExport("index"),
        "./metadata": subpathExport("metadata"),
    };

    const files = [{ fileName: "metadata.ts", source: metadata }];
    const indexExports: string[] = [];

    for (const { directory, source } of namespaces) {
        files.push({ fileName: `${directory}/${directory}.tsx`, source }, namespaceBarrel(directory));
        exportsMap[`./${directory}`] = subpathExport(`${directory}/index`);
        indexExports.push(`export * from "./${directory}/index.js";`);
    }

    files.push({ fileName: "index.ts", source: `${indexExports.join("\n")}\n` });

    writeStore({
        storeDir: options.storeDir,
        linkDir: options.linkDir,
        files,
        manifest: buildManifest({
            name: "@gtkx/jsx",
            version: options.version,
            exports: exportsMap,
            peerDependencies: jsxPeerDependencies(externalPackages),
        }),
        rawFiles,
    });
};

export { writeJsxStore };
