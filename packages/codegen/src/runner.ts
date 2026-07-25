import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkModules } from "./compile.js";
import { isGiStoreFresh } from "./fingerprint.js";
import { runGiCodegen } from "./gi.js";
import { Library } from "./gir/library.js";
import { type GlGenerationReport, generateGlModules } from "./khronos/pipeline.js";
import type { GiStoreOptions } from "./store/gi-store.js";
import type { JsxStoreOptions } from "./store/jsx-store.js";

type ModuleExport = { module: string; export: string };

export type GlCodegenOptions = {
    registryPath: string;
    overrideExports: Set<string>;
    outputDir: string;
    resolveFrom: string;
};

export type CodegenRunnerOptions = {
    libraries?: string[];
    girPath?: string[];
    gi?: GiStoreOptions;
    jsx?: JsxStoreOptions | undefined;
    reactSubexports?: string[];
    userComponents?: Record<string, ModuleExport>;
    userLazyElements?: string[];
    userProps?: Record<string, ModuleExport>;
    gl?: GlCodegenOptions;
    force?: boolean;
};

export type CodegenRunnerResult = {
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
export const runCodegen = async (options: CodegenRunnerOptions): Promise<CodegenRunnerResult> => {
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

const emitStores = async (options: CodegenRunnerOptions): Promise<StoreResult> => {
    const { gi, jsx, libraries, girPath } = options;
    if (gi === undefined || libraries === undefined || girPath === undefined) {
        return { regenerated: false, namespaces: 0, intrinsicElements: 0 };
    }
    let library: Library | undefined;
    const loadLibrary = (): Library => (library ??= Library.load(libraries, girPath));

    const giRegenerated = options.force === true || !isGiStoreFresh(gi.storeDir, libraries);
    const namespaces = giRegenerated ? runGiCodegen(loadLibrary(), gi, libraries) : 0;

    if (jsx === undefined) return { regenerated: giRegenerated, namespaces, intrinsicElements: 0 };

    const { runJsxCodegen } = await import("./jsx.js");
    const jsxResult = await runJsxCodegen({
        getLibrary: loadLibrary,
        jsx,
        giStoreDir: gi.storeDir,
        reactSubexports: options.reactSubexports ?? [],
        userComponents: options.userComponents ?? {},
        userLazyElements: options.userLazyElements ?? [],
        userProps: options.userProps ?? {},
        giRegenerated,
        force: options.force === true,
    });

    return {
        regenerated: giRegenerated || jsxResult.regenerated,
        namespaces,
        intrinsicElements: jsxResult.intrinsicElementCount,
    };
};
