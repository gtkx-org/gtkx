import type { ElementPropsExport } from "@gtkx/config/elements";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import type { ModuleExport } from "./react/element-config.js";
import type { OmittedProps } from "./store/jsx/omitted-props.js";
import { checkModules } from "./compile.js";
import { hashElementConfig, isGiStoreFresh } from "./fingerprint.js";
import { runGiCodegen } from "./gi.js";
import { Library } from "./gir/library.js";
import { generateGlModules, type GlGenerationReport } from "./khronos/pipeline.js";
import { acquireStoreLocks, sweepStagingDirs } from "./staging.js";
import { registerSharedProject, shareStore, type SharedProject } from "./store/shared-store.js";
import {
    discardPreparedStore,
    ensureStoreLink,
    type PreparedStore,
    hasStoreLayout,
    linkStoreDependencies,
    publishStores,
    reclaimStoreArtifacts,
    type StoreOptions,
} from "./store/store-fs.js";
import { writeSharedStoreViews } from "./store/store-views.js";

type GlCodegenOptions = {
    registryPath: string;
    overridePath: string;
    outputDir: string;
    resolveFrom: string;
};

/** What to generate and where to write it. */
type CodegenRunnerOptions = {
    /** GIR library identifiers such as `"Gtk-4.0"`. */
    libraries: string[];
    /** Directories to search for `.gir` files. */
    girPath: string[];
    /**
     * Where to write and link the `@gtkx/gi` store. With an `owner`, the store is shared with the other projects
     * that generated it and binds the union of their libraries. Each sharing project whose own `node_modules` does
     * not hold the store gets a view there that exports only the namespaces of its libraries.
     */
    gi: StoreOptions;
    /** Where to write and link the `@gtkx/jsx` store; omit to generate the gi store alone. */
    jsx?: StoreOptions | undefined;
    /** Component wrappers the project layers over the built-ins, keyed by GLib type name. */
    userComponents?: Record<string, ModuleExport>;
    /** GLib type names whose GObject their parent container creates, added to the framework's own. */
    userLazyElements?: string[];
    /** Base props interfaces the project's elements extend, keyed by GLib type name. */
    userProps?: Record<string, ElementPropsExport>;
    /** Props the project drops from the generated element props, keyed by GLib type name. */
    userOmittedProps?: OmittedProps;
    /** Regenerates both stores even when their fingerprints are fresh. */
    isForced?: boolean;
    /**
     * Drops the projects sharing the store whose requirements conflict with this one instead of failing; they
     * share it again when they next generate compatible bindings.
     */
    isSharingForced?: boolean;
    /** Maximum wait for each generated-store lock in milliseconds. Defaults to ten minutes. */
    lockTimeoutMs?: number | undefined;
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

type GiStoreResult = { isRegenerated: boolean; namespaces: number; store: PreparedStore | undefined };

/**
 * Generates and links a project's GI and JSX stores from GObject Introspection libraries.
 * Use `resolveStore(projectRoot)` for store locations and versions; omit `jsx` when it is null.
 *
 * @remarks
 * GI regenerates when its inputs change; JSX regenerates when GI or element configuration
 * changes. `isForced` bypasses freshness checks. Existing stores are linked before generation,
 * restoring links removed during dependency installation even when regeneration is unnecessary.
 *
 * @param options Libraries, GIR paths, store locations, and generation settings.
 * @returns Regenerated outputs and elapsed time.
 * @throws If `girPath` is empty.
 */
const runCodegen = async (options: CodegenRunnerOptions): Promise<CodegenRunnerResult> => {
    const start = Date.now();
    const stores = [options.gi.storeDir];

    if (options.jsx !== undefined) {
        stores.push(options.jsx.storeDir);
    }

    const release = await acquireStoreLocks(stores, options.lockTimeoutMs);

    try {
        const store = await emitStores(options);

        return {
            isRegenerated: store.isRegenerated,
            namespaces: store.namespaces,
            intrinsicElements: store.intrinsicElements,
            duration: Date.now() - start,
        };
    } finally {
        release();
    }
};

const moduleExportNames = (path: string): Set<string> => {
    const program = ts.createProgram([path], {
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
    });
    const source = program.getSourceFile(path);

    if (source === undefined) {
        throw new Error(`TypeScript did not load ${path}`);
    }

    const checker = program.getTypeChecker();
    const symbol = checker.getSymbolAtLocation(source);

    if (symbol === undefined) {
        throw new Error(`TypeScript did not create a module symbol for ${path}`);
    }

    return new Set(checker.getExportsOfModule(symbol).map((entry) => entry.getName()));
};

const runGlCodegen = (options: GlCodegenOptions): GlGenerationReport => {
    const { files, report } = generateGlModules({
        registryPath: options.registryPath,
        overrideExports: moduleExportNames(options.overridePath),
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

const jsxUserOptions = (options: CodegenRunnerOptions) => ({
    userComponents: options.userComponents ?? {},
    userLazyElements: options.userLazyElements ?? [],
    userProps: options.userProps ?? {},
    userOmittedProps: options.userOmittedProps ?? {},
});

const emitGiStore = (options: CodegenRunnerOptions, loadLibrary: () => Library): GiStoreResult => {
    const { gi, libraries, girPath } = options;
    const giInputs = { girFiles: [] as string[], libraries, girPath, storeVersion: gi.version };
    const isRegenerated = options.isForced === true || !isGiStoreFresh(gi.storeDir, giInputs);

    if (!isRegenerated) {
        return { isRegenerated, namespaces: 0, store: undefined };
    }

    const result = runGiCodegen(loadLibrary(), { gi, libraries, girPath });

    return { isRegenerated, namespaces: result.namespaces, store: result.store };
};

const sharedProject = (options: CodegenRunnerOptions): SharedProject => ({
    libraries: options.libraries,
    girPath: options.girPath,
    jsx:
        options.jsx === undefined
            ? null
            : hashElementConfig({
                  components: options.userComponents ?? {},
                  lazyElements: options.userLazyElements ?? [],
                  props: options.userProps ?? {},
                  omittedProps: options.userOmittedProps ?? {},
              }),
});

const emitStores = async (input: CodegenRunnerOptions): Promise<StoreResult> => {
    const { gi, jsx, girPath } = input;

    if (girPath.length === 0) {
        throw new Error("codegen needs at least one GIR search path; pass the result of resolveGirPath");
    }

    const { owner } = gi;
    const project = sharedProject(input);
    const shared =
        owner === undefined
            ? null
            : { owner, ...shareStore(gi.storeDir, owner, project, input.isSharingForced === true) };
    const libraries = shared?.libraries ?? input.libraries;
    const options = hasStoreLayout(gi, jsx) ? { ...input, libraries } : { ...input, libraries, isForced: true };
    reclaimStoreArtifacts(gi);

    for (const store of [gi, jsx]) {
        if (store !== undefined) {
            sweepStagingDirs(store.storeDir);
            linkStoreDependencies(store);
            ensureStoreLink(store);
        }
    }

    let library: Library | undefined;
    const loadLibrary = (): Library => (library ??= Library.load(libraries, girPath));
    const giResult = emitGiStore(options, loadLibrary);
    let jsxStore: PreparedStore | undefined;
    let intrinsicElements = 0;

    try {
        if (jsx !== undefined) {
            const { runJsxCodegen } = await import("./jsx.js");
            const result = await runJsxCodegen({
                getLibrary: loadLibrary,
                jsx,
                ...jsxUserOptions(options),
                isGiRegenerated: giResult.isRegenerated,
                isForced: options.isForced === true,
            });
            jsxStore = result.store;
            intrinsicElements = result.intrinsicElementCount;
        }

        if (giResult.store !== undefined || jsxStore !== undefined) {
            publishStores({ gi: giResult.store, giLink: gi, jsx: jsxStore, jsxLink: jsx });
        }

        if (shared !== null) {
            registerSharedProject(gi.storeDir, shared.owner, project, shared);
            writeSharedStoreViews(gi, jsx ?? null, [[shared.owner, project], ...shared.others]);
        }

        return {
            isRegenerated: giResult.isRegenerated || jsxStore !== undefined,
            namespaces: giResult.namespaces,
            intrinsicElements,
        };
    } catch (error) {
        discardPreparedStore(giResult.store);
        discardPreparedStore(jsxStore);
        throw error;
    }
};

export { runCodegen, runGlCodegen, type CodegenRunnerOptions, type CodegenRunnerResult };
