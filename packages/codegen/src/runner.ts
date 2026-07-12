import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ElementProp } from "@gtkx/config";
import { checkModules } from "./compile.js";
import { computeFingerprint, isStoreFresh } from "./fingerprint.js";
import { Library } from "./gir/library.js";
import { namespaceDirectory } from "./gir/namespace.js";
import { type GlGenerationReport, generateGlModules } from "./khronos/pipeline.js";
import { generateNamespaceModule } from "./store/gi/pipeline.js";
import { type GiNamespaceInput, type GiStoreOptions, writeGiStore } from "./store/gi-store.js";
import { type JsxStoreOptions, writeJsxStore } from "./store/jsx-store.js";
import { generateJsxFiles } from "./store/react/pipeline.js";

/** OpenGL binding generation inputs for the `@gtkx/gl` package. */
export type GlCodegenOptions = {
    /** Filesystem path to the Khronos OpenGL registry XML (`gl.xml`) the bindings are generated from. */
    registryPath: string;
    /** Names exported by hand-written override modules, reserved so generated exports never collide with them. */
    overrideExports: Set<string>;
    /** Directory the generated OpenGL modules (`types.ts`, `enums.ts`, `commands.ts`) are written to. */
    outputDir: string;
    /** Directory whose `node_modules` resolve the imports while the generated modules are type checked before being written. */
    resolveFrom: string;
};

/** Inputs controlling a single {@link runCodegen} invocation. */
export type CodegenRunnerOptions = {
    /** GObject-introspection namespaces to load, for example `["Gtk-4.0"]`; required together with `girPath` and `gi` for the gi and jsx stores to be generated. */
    libraries?: string[];
    /** Directories searched for `.gir` files when loading `libraries`. */
    girPath?: string[];
    /** Extra JSX element property definitions keyed by element name, merged into the generated jsx metadata and folded into the freshness fingerprint. */
    elementProps?: Record<string, ElementProp[]> | undefined;
    /** Destination and version for the generated `@gtkx/gi` store; when omitted, gi and jsx generation are skipped. */
    gi?: GiStoreOptions;
    /** Destination and version for the generated `@gtkx/jsx` store; when omitted, jsx generation is skipped while gi is still emitted. */
    jsx?: JsxStoreOptions | undefined;
    /** OpenGL binding options; when omitted, `@gtkx/gl` generation is skipped. */
    gl?: GlCodegenOptions;
    /** Regenerate the gi store even when its fingerprint reports it is already up to date. */
    force?: boolean;
};

/** Summary returned by {@link runCodegen} describing what was produced. */
export type CodegenRunnerResult = {
    /** Whether the gi store was written on this run; `false` when it was already fresh or gi generation was skipped. */
    regenerated: boolean;
    /** Number of GObject-introspection namespaces emitted into the gi store. */
    namespaces: number;
    /** Number of intrinsic JSX elements emitted into the jsx store. */
    intrinsicElements: number;
    /** Wall-clock duration of the run in milliseconds. */
    duration: number;
    /** Report describing the OpenGL generation, present only when `gl` options were supplied. */
    gl?: GlGenerationReport | undefined;
};

type GiEmitResult = {
    namespaces: number;
    intrinsicElements: number;
};

/**
 * Runs the `@gtkx` code generators, producing the `@gtkx/gi`, `@gtkx/jsx`, and `@gtkx/gl` bindings from the
 * configured GObject-introspection libraries and OpenGL registry. The gi store is regenerated only when its
 * fingerprint is stale unless `options.force` is set, while the OpenGL modules are regenerated whenever
 * `options.gl` is provided.
 *
 * @param options - What to generate and where to write it.
 * @returns A summary of what was regenerated and how long the run took.
 */
export const runCodegen = async (options: CodegenRunnerOptions): Promise<CodegenRunnerResult> => {
    const start = Date.now();
    const gl = options.gl === undefined ? undefined : emitGlModules(options.gl);
    const gi = emitGiStoreIfStale(options);
    return {
        regenerated: gi !== undefined,
        namespaces: gi?.namespaces ?? 0,
        intrinsicElements: gi?.intrinsicElements ?? 0,
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

const emitGiStoreIfStale = (options: CodegenRunnerOptions): GiEmitResult | undefined => {
    const { gi, libraries, girPath } = options;
    if (gi === undefined || libraries === undefined || girPath === undefined) return undefined;
    const elementProps = options.elementProps ?? {};
    if (options.force !== true && isStoreFresh(gi.storeDir, libraries, elementProps)) return undefined;
    const library = Library.load(libraries, girPath);
    emitGiStore(gi, libraries, elementProps, library);
    return {
        namespaces: library.namespaces.size,
        intrinsicElements: emitJsxStore(options.jsx, elementProps, library),
    };
};

const emitGiStore = (
    gi: GiStoreOptions,
    libraries: string[],
    elementProps: Record<string, ElementProp[]>,
    library: Library,
): void => {
    const namespaces: GiNamespaceInput[] = [];
    for (const namespace of library.namespaces.values()) {
        namespaces.push({
            directory: namespaceDirectory(namespace),
            rawSource: generateNamespaceModule(namespace, library),
        });
    }
    const libs = [...libraries];
    writeGiStore(gi, namespaces, {
        value: computeFingerprint(library.girFiles, libs, elementProps),
        girFiles: library.girFiles,
        libraries: libs,
    });
};

const emitJsxStore = (
    jsx: JsxStoreOptions | undefined,
    elementProps: Record<string, ElementProp[]>,
    library: Library,
): number => {
    if (jsx === undefined) return 0;
    const reactPipeline = generateJsxFiles(library, elementProps);
    writeJsxStore(jsx, reactPipeline.namespaces, reactPipeline.metadata);
    return reactPipeline.intrinsicElementCount;
};
