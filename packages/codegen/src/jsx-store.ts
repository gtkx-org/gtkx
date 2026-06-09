import type { JsxNamespaceFile } from "./react/pipeline.js";
import { type StoreOptions, writeStore } from "./store-fs.js";

/**
 * Options for assembling the injected `@gtkx/jsx` package.
 */
export type JsxStoreOptions = StoreOptions & {
    /** Absolute path to the gi store, for the unit's own `node_modules/@gtkx/gi`. */
    readonly giStoreDir: string;
    /** Real (symlink-resolved) directory of the installed `react` runtime. */
    readonly realReactRuntimeDir: string;
    /** Real (symlink-resolved) directory of the installed `@gtkx/react`. */
    readonly realReactPackageDir: string;
};

/**
 * Assembles the self-contained injected `@gtkx/jsx` package: one module per
 * namespace (`<ns>/<ns>.tsx`), the merged `metadata.ts`, a `package.json` with a
 * per-namespace `exports` map, and the package's own `node_modules` symlinks. The
 * self-referential `@gtkx/jsx` link lets a namespace module resolve a sibling
 * namespace's `Props` types through `@gtkx/jsx/<ns>`; the `@gtkx/react` and
 * `react` links resolve the runtime imports each module makes.
 *
 * Mirrors `@gtkx/gi`: `sideEffects: true`, so the bundler never drops a
 * namespace module's `@gtkx/gi/<ns>` side-effect import. The merged `./metadata`
 * carries no namespace imports and is delivered to `@gtkx/react` through the
 * `virtual:gtkx-config` Vite module.
 *
 * @param options - Resolved store/link/dependency paths
 * @param namespaces - Per-namespace module sources
 * @param metadata - The merged metadata module source
 */
export const writeJsxStore = (
    options: JsxStoreOptions,
    namespaces: readonly JsxNamespaceFile[],
    metadata: string,
): void => {
    const exportsMap: Record<string, unknown> = {
        "./package.json": "./package.json",
        "./metadata": { types: "./metadata.d.ts", default: "./metadata.js" },
    };
    const files = [{ stem: "metadata", fileName: "metadata.ts", source: metadata }];
    for (const { directory, source } of namespaces) {
        files.push({ stem: `${directory}/${directory}`, fileName: `${directory}/${directory}.tsx`, source });
        exportsMap[`./${directory}`] = {
            types: `./${directory}/${directory}.d.ts`,
            default: `./${directory}/${directory}.js`,
        };
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
