import { sortStrings } from "@gtkx/utils";
import type { JsxNamespaceFile } from "./jsx/pipeline.js";
import type { PreparedStore, RawFile } from "./store-fs.js";
import { buildManifest, namespaceBarrel, prepareStore, type StoreOptions, subpathExport } from "./store-fs.js";

type WriteJsxStoreParams = {
    options: StoreOptions;
    namespaces: JsxNamespaceFile[];
    metadata: string;
    externalPackages: string[];
    rawFiles: RawFile[];
    giStoreDir: string;
};

const jsxPeerDependencies = (externalPackages: string[]): Record<string, string> => {
    return Object.fromEntries(
        sortStrings(["@gtkx/gi", "@gtkx/react", "@gtkx/runtime", "react", ...externalPackages])
            .map((name) => [name, "*"]),
    );
};

const writeJsxStore = (params: WriteJsxStoreParams): PreparedStore => {
    const { options, namespaces, metadata, externalPackages, rawFiles } = params;

    const namespaceExports: Record<string, unknown> = {
        "./metadata": subpathExport("metadata"),
    };

    const files = [{ fileName: "metadata.ts", source: metadata }];

    for (const { directory, source } of namespaces) {
        files.push({ fileName: `${directory}/${directory}.tsx`, source }, namespaceBarrel(directory));
        namespaceExports[`./${directory}`] = subpathExport(`${directory}/index`);
    }

    return prepareStore({
        storeDir: options.storeDir,
        linkDir: options.linkDir,
        owner: options.owner,
        compileDependencies: { "@gtkx/gi": params.giStoreDir },
        files,
        manifest: buildManifest({
            name: "@gtkx/jsx",
            version: options.version,
            exports: namespaceExports,
            sideEffects: false,
            peerDependencies: jsxPeerDependencies(externalPackages),
        }),
        rawFiles,
    });
};

export { writeJsxStore };
