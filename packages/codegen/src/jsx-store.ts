import { join } from "node:path";
import { resetDir, swapStore, symlinkRelative, tempStoreFor, writeFilePair, writePackageJson } from "./store-fs.js";

/**
 * Options for assembling the injected `@gtkx/react-jsx` unit.
 */
export type JsxStoreOptions = {
    /** Absolute path to the hidden store directory (`node_modules/.gtkx/jsx`). */
    readonly storeDir: string;
    /** Absolute path to the visible symlink (`node_modules/@gtkx/react-jsx`). */
    readonly linkDir: string;
    /** Absolute path to the gi store, for the unit's own `node_modules/@gtkx/gi`. */
    readonly giStoreDir: string;
    /** Real (symlink-resolved) directory of the installed `react` runtime. */
    readonly realReactRuntimeDir: string;
    /** Real (symlink-resolved) directory of the installed `@gtkx/react`. */
    readonly realReactPackageDir: string;
    /** Version string copied onto the emitted `@gtkx/react-jsx` package. */
    readonly version: string;
};

const stem = (relativePath: string): string => relativePath.replace(/\.(tsx|ts)$/, "");

/**
 * Assembles the self-contained injected `@gtkx/react-jsx` unit: the generated
 * `jsx`/`internal`/`compounds` modules plus a `package.json` and the unit's own
 * `node_modules` symlinks to `@gtkx/gi` and `react`.
 *
 * @param options - Resolved store/link/dependency paths
 * @param files - React pipeline output keyed by source filename
 */
export const writeJsxStore = (options: JsxStoreOptions, files: ReadonlyMap<string, string>): void => {
    const tmp = tempStoreFor(options.storeDir);
    resetDir(tmp);

    for (const [relativePath, source] of files) {
        writeFilePair(tmp, stem(relativePath), relativePath, source);
    }

    writePackageJson(tmp, {
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
        },
    });

    symlinkRelative(join(tmp, "node_modules", "@gtkx", "gi"), options.giStoreDir);
    symlinkRelative(join(tmp, "node_modules", "@gtkx", "react"), options.realReactPackageDir);
    symlinkRelative(join(tmp, "node_modules", "react"), options.realReactRuntimeDir);

    swapStore(tmp, options.storeDir, options.linkDir);
};
