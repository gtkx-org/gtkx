import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ModuleExport } from "./react/element-config.js";
import type { OmittedProps } from "./store/jsx/omitted-props.js";
import { checkModules } from "./compile.js";
import { isGiStoreFresh } from "./fingerprint.js";
import { runGiCodegen } from "./gi.js";
import { Library } from "./gir/library.js";
import { generateGlModules, type GlGenerationReport } from "./khronos/pipeline.js";
import { sweepStagingDirs } from "./staging.js";
import { ensureStoreLink, type StoreOptions } from "./store/store-fs.js";

type GlCodegenOptions = {
    registryPath: string;
    overrideExports: Set<string>;
    outputDir: string;
    resolveFrom: string;
};

/** What to generate and where to write it. */
type CodegenRunnerOptions = {
    /** GIR library identifiers such as `"Gtk-4.0"`; a `"*"` selection must be expanded before it gets here. */
    libraries: string[];
    /** Directories to search for `.gir` files. */
    girPath: string[];
    /** Where to write and link the `@gtkx/gi` store. */
    gi: StoreOptions;
    /** Where to write and link the `@gtkx/jsx` store; omit to generate the gi store alone. */
    jsx?: StoreOptions | undefined;
    /** Subexport names of the installed `@gtkx/react`, whose element config shapes the jsx store. */
    reactSubexports?: string[];
    /** Component wrappers the project layers over the built-ins, keyed by GLib type name. */
    userComponents?: Record<string, ModuleExport>;
    /** GLib type names whose GObject their parent container creates, added to the framework's own. */
    userLazyElements?: string[];
    /** Base props interfaces the project's elements extend, keyed by GLib type name. */
    userProps?: Record<string, ModuleExport>;
    /** Props the project drops from the generated element props, keyed by GLib type name. */
    userOmittedProps?: OmittedProps;
    /** Regenerates both stores even when their fingerprints are fresh. */
    isForced?: boolean;
    /** Emits GIR byte sequences as `Uint8Array` rather than `number[]`; defaults to false. */
    isByteArrayTyped?: boolean;
};

/** What a `runCodegen` run produced. */
type CodegenRunnerResult = {
    /** Whether either store was rewritten; false means both were already fresh. */
    isRegenerated: boolean;
    /** How many namespaces the gi store was written with, zero when it was already fresh. */
    namespaces: number;
    /** How many JSX elements the jsx store binds, zero when no jsx store was requested. */
    intrinsicElements: number;
    /** Wall-clock duration of the run, in milliseconds. */
    duration: number;
};

type StoreResult = {
    isRegenerated: boolean;
    namespaces: number;
    intrinsicElements: number;
};

/**
 * Writes and links a project's `@gtkx/gi` and `@gtkx/jsx` stores from the given GObject-Introspection
 * libraries. The gi store is rewritten only when its GIR inputs changed, and the jsx store only when the gi
 * store or the React element config changed, unless `options.isForced` is set. Pass the spread of
 * `resolveStore(projectRoot)` for everything but `libraries` and `girPath`.
 *
 * Every store already on disk is linked at its `linkDir` before anything is generated, so a link an install
 * pruned out of `node_modules` is restored without regenerating the store, and the gi store is reachable
 * under its own specifier while the jsx store is type checked.
 *
 * @param options What to generate and where to write it.
 * @returns A summary of what was regenerated and how long the run took.
 * @throws If `girPath` is empty, which would otherwise generate nothing and report success.
 */
const runCodegen = async (options: CodegenRunnerOptions): Promise<CodegenRunnerResult> => {
    const start = Date.now();
    const store = await emitStores(options);

    return {
        isRegenerated: store.isRegenerated,
        namespaces: store.namespaces,
        intrinsicElements: store.intrinsicElements,
        duration: Date.now() - start,
    };
};

const runGlCodegen = (options: GlCodegenOptions): GlGenerationReport => {
    const { files, report } = generateGlModules({
        registryPath: options.registryPath,
        overrideExports: options.overrideExports,
    });

    checkModules({
        modules: [...files].map(([fileName, source]) => ({ fileName, source })),
        resolveFrom: options.resolveFrom,
        label: "the generated gl modules",
    });

    mkdirSync(options.outputDir, { recursive: true });

    for (const [fileName, source] of files) {
        writeFileSync(join(options.outputDir, fileName), source);
    }

    return report;
};

const jsxUserOptions = (
    options: CodegenRunnerOptions,
): {
    reactSubexports: string[];
    userComponents: Record<string, ModuleExport>;
    userLazyElements: string[];
    userProps: Record<string, ModuleExport>;
    userOmittedProps: OmittedProps;
} => ({
    reactSubexports: options.reactSubexports ?? [],
    userComponents: options.userComponents ?? {},
    userLazyElements: options.userLazyElements ?? [],
    userProps: options.userProps ?? {},
    userOmittedProps: options.userOmittedProps ?? {},
});

const emitJsxStore = async (input: {
    options: CodegenRunnerOptions;
    jsx: StoreOptions;
    gi: StoreOptions;
    loadLibrary: () => Library;
    isGiRegenerated: boolean;
    namespaces: number;
}): Promise<StoreResult> => {
    const { options, jsx, gi, loadLibrary, isGiRegenerated, namespaces } = input;
    const { runJsxCodegen } = await import("./jsx.js");

    const jsxResult = await runJsxCodegen({
        getLibrary: loadLibrary,
        jsx,
        giStoreDir: gi.storeDir,
        ...jsxUserOptions(options),
        isGiRegenerated,
        isForced: options.isForced === true,
    });

    return {
        isRegenerated: isGiRegenerated || jsxResult.isRegenerated,
        namespaces,
        intrinsicElements: jsxResult.intrinsicElementCount,
    };
};

const emitStoresWithConfig = async (config: {
    options: CodegenRunnerOptions;
    gi: StoreOptions;
    jsx: StoreOptions | undefined;
    libraries: string[];
    girPath: string[];
}): Promise<StoreResult> => {
    const { options, gi, jsx, libraries, girPath } = config;
    const isByteArrayTyped = options.isByteArrayTyped === true;
    let library: Library | undefined;
    const loadLibrary = (): Library => (library ??= Library.load(libraries, girPath, isByteArrayTyped));
    const giInputs = { girFiles: [] as string[], libraries, girPath, isByteArrayTyped };
    const isGiRegenerated = options.isForced === true || !isGiStoreFresh(gi.storeDir, giInputs);

    const namespaces = isGiRegenerated
        ? runGiCodegen(loadLibrary(), { gi, libraries, girPath, isByteArrayTyped })
        : 0;

    if (jsx === undefined) {
        return { isRegenerated: isGiRegenerated, namespaces, intrinsicElements: 0 };
    }

    return emitJsxStore({ options, jsx, gi, loadLibrary, isGiRegenerated, namespaces });
};

const prepareStores = (stores: (StoreOptions | undefined)[]): void => {
    for (const store of stores) {
        if (store === undefined) {
            continue;
        }

        sweepStagingDirs(store.storeDir);
        ensureStoreLink(store);
    }
};

const emitStores = async (options: CodegenRunnerOptions): Promise<StoreResult> => {
    const { gi, jsx, libraries, girPath } = options;

    if (girPath.length === 0) {
        throw new Error("codegen needs at least one GIR search path; pass the result of resolveGirPath");
    }

    prepareStores([gi, jsx]);

    return emitStoresWithConfig({ options, gi, jsx, libraries, girPath });
};

export { runCodegen, runGlCodegen, type CodegenRunnerOptions, type CodegenRunnerResult };
