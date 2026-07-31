import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GiStoreOptions } from "./store/gi-store.js";
import type { JsxStoreOptions } from "./store/jsx-store.js";
import type { OmittedProps } from "./store/jsx/omitted-props.js";
import { checkModules } from "./compile.js";
import { isGiStoreFresh } from "./fingerprint.js";
import { runGiCodegen } from "./gi.js";
import { Library } from "./gir/library.js";
import { generateGlModules, type GlGenerationReport } from "./khronos/pipeline.js";

type ModuleExport = { module: string; export: string };

type GlCodegenOptions = {
    registryPath: string;
    overrideExports: Set<string>;
    outputDir: string;
    resolveFrom: string;
};

type CodegenRunnerOptions = {
    libraries?: string[];
    girPath?: string[];
    gi?: GiStoreOptions;
    jsx?: JsxStoreOptions | undefined;
    reactSubexports?: string[];
    userComponents?: Record<string, ModuleExport>;
    userLazyElements?: string[];
    userProps?: Record<string, ModuleExport>;
    userOmitProps?: OmittedProps;
    gl?: GlCodegenOptions;
    force?: boolean;
};

type CodegenRunnerResult = {
    regenerated: boolean;
    namespaces: number;
    intrinsicElements: number;
    duration: number;
    gl?: GlGenerationReport | undefined;
};

type StoreResult = {
    regenerated: boolean;
    namespaces: number;
    intrinsicElements: number;
};

/**
 * Runs the `@gtkx` code generators, producing the `@gtkx/gi`, `@gtkx/jsx`, and `@gtkx/gl` bindings from the
 * configured GObject-introspection libraries and OpenGL registry. The gi store is regenerated only when its
 * fingerprint is stale unless `options.force` is set, then the jsx store is regenerated when the gi store or
 * the React element config changed; the OpenGL modules are regenerated whenever `options.gl` is provided.
 *
 * @param options - What to generate and where to write it.
 * @returns A summary of what was regenerated and how long the run took.
 */
const runCodegen = async (options: CodegenRunnerOptions): Promise<CodegenRunnerResult> => {
    const start = Date.now();
    const gl = options.gl === undefined ? undefined : emitGlModules(options.gl);
    const store = await emitStores(options);

    return {
        regenerated: store.regenerated,
        namespaces: store.namespaces,
        intrinsicElements: store.intrinsicElements,
        duration: Date.now() - start,
        gl,
    };
};

const emitGlModules = (options: GlCodegenOptions): GlGenerationReport => {
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
    userOmitProps: OmittedProps;
} => ({
    reactSubexports: options.reactSubexports ?? [],
    userComponents: options.userComponents ?? {},
    userLazyElements: options.userLazyElements ?? [],
    userProps: options.userProps ?? {},
    userOmitProps: options.userOmitProps ?? {},
});

const emitJsxStore = async (input: {
    options: CodegenRunnerOptions;
    jsx: JsxStoreOptions;
    gi: GiStoreOptions;
    loadLibrary: () => Library;
    giRegenerated: boolean;
    namespaces: number;
}): Promise<StoreResult> => {
    const { options, jsx, gi, loadLibrary, giRegenerated, namespaces } = input;
    const { runJsxCodegen } = await import("./jsx.js");

    const jsxResult = await runJsxCodegen({
        getLibrary: loadLibrary,
        jsx,
        giStoreDir: gi.storeDir,
        ...jsxUserOptions(options),
        giRegenerated,
        force: options.force === true,
    });

    return {
        regenerated: giRegenerated || jsxResult.regenerated,
        namespaces,
        intrinsicElements: jsxResult.intrinsicElementCount,
    };
};

const emitStoresWithConfig = async (config: {
    options: CodegenRunnerOptions;
    gi: GiStoreOptions;
    jsx: JsxStoreOptions | undefined;
    libraries: string[];
    girPath: string[];
}): Promise<StoreResult> => {
    const { options, gi, jsx, libraries, girPath } = config;
    let library: Library | undefined;
    const loadLibrary = (): Library => (library ??= Library.load(libraries, girPath));
    const isGiRegenerated = options.force === true || !isGiStoreFresh(gi.storeDir, libraries, girPath);

    const namespaces = isGiRegenerated
        ? runGiCodegen(loadLibrary(), { gi, libraries, girPath })
        : 0;

    if (jsx === undefined) {
        return { regenerated: isGiRegenerated, namespaces, intrinsicElements: 0 };
    }

    return emitJsxStore({ options, jsx, gi, loadLibrary, giRegenerated: isGiRegenerated, namespaces });
};

const emitStores = async (options: CodegenRunnerOptions): Promise<StoreResult> => {
    const { gi, jsx, libraries, girPath } = options;

    if (gi === undefined || libraries === undefined || girPath === undefined) {
        return { regenerated: false, namespaces: 0, intrinsicElements: 0 };
    }

    return emitStoresWithConfig({ options, gi, jsx, libraries, girPath });
};

export { runCodegen, type GlCodegenOptions, type CodegenRunnerOptions, type CodegenRunnerResult };
