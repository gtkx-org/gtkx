import { type StoreOptions, writeStore } from "./store-fs.js";

/**
 * Options for assembling the injected `@gtkx/react-jsx` unit.
 */
export type JsxStoreOptions = StoreOptions & {
    /** Absolute path to the gi store, for the unit's own `node_modules/@gtkx/gi`. */
    readonly giStoreDir: string;
    /** Real (symlink-resolved) directory of the installed `react` runtime. */
    readonly realReactRuntimeDir: string;
    /** Real (symlink-resolved) directory of the installed `@gtkx/react`. */
    readonly realReactPackageDir: string;
};

const stem = (relativePath: string): string => relativePath.replace(/\.(tsx|ts)$/, "");

/**
 * Assembles the self-contained injected `@gtkx/react-jsx` unit: the generated
 * `jsx`/`internal`/`compounds`/`presence` modules plus a `package.json` and the
 * unit's own `node_modules` symlinks to `@gtkx/gi` and `react`.
 *
 * @param options - Resolved store/link/dependency paths
 * @param files - React pipeline output keyed by source filename
 */
export const writeJsxStore = (options: JsxStoreOptions, files: ReadonlyMap<string, string>): void => {
    writeStore({
        storeDir: options.storeDir,
        linkDir: options.linkDir,
        files: [...files].map(([relativePath, source]) => ({
            stem: stem(relativePath),
            fileName: relativePath,
            source,
        })),
        manifest: {
            name: "@gtkx/react-jsx",
            type: "module",
            version: options.version,
            sideEffects: ["./internal.js"],
            exports: {
                "./package.json": "./package.json",
                ".": { types: "./jsx.d.ts", default: "./jsx.js" },
                "./jsx": { types: "./jsx.d.ts", default: "./jsx.js" },
                "./compounds": { types: "./compounds.d.ts", default: "./compounds.js" },
                "./internal": { types: "./internal.d.ts", default: "./internal.js" },
                "./presence": { types: "./presence.d.ts", default: "./presence.js" },
            },
        },
        symlinks: [
            { segments: ["node_modules", "@gtkx", "gi"], target: options.giStoreDir },
            { segments: ["node_modules", "@gtkx", "react"], target: options.realReactPackageDir },
            { segments: ["node_modules", "react"], target: options.realReactRuntimeDir },
        ],
    });
};
