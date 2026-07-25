import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkModules } from "./compile.js";
import { computeFingerprint, isStoreFresh } from "./fingerprint.js";
import { Library } from "./gir/library.js";
import { namespaceDirectory } from "./gir/namespace.js";
import { type GlGenerationReport, generateGlModules } from "./khronos/pipeline.js";
import { generateNamespaceModule } from "./store/gi/pipeline.js";
import { type GiNamespaceInput, type GiStoreOptions, writeGiStore } from "./store/gi-store.js";
import { type JsxStoreOptions, writeJsxStore } from "./store/jsx-store.js";
import { generateJsxFiles } from "./store/react/pipeline.js";

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
    if (options.force !== true && isStoreFresh(gi.storeDir, libraries)) return undefined;
    const library = Library.load(libraries, girPath);
    emitGiStore(gi, libraries, library);
    return {
        namespaces: library.namespaces.size,
        intrinsicElements: emitJsxStore(options.jsx, library, options.reactSubexports ?? []),
    };
};

const emitGiStore = (gi: GiStoreOptions, libraries: string[], library: Library): void => {
    const namespaces: GiNamespaceInput[] = [];
    for (const namespace of library.namespaces.values()) {
        namespaces.push({
            directory: namespaceDirectory(namespace),
            rawSource: generateNamespaceModule(namespace, library),
        });
    }
    const libs = [...libraries];
    writeGiStore(gi, namespaces, {
        value: computeFingerprint(library.girFiles, libs),
        girFiles: library.girFiles,
        libraries: libs,
    });
};

const emitJsxStore = (jsx: JsxStoreOptions | undefined, library: Library, reactSubexports: string[]): number => {
    if (jsx === undefined) return 0;
    const reactPipeline = generateJsxFiles(library, reactSubexports);
    writeJsxStore(jsx, reactPipeline.namespaces, reactPipeline.metadata);
    return reactPipeline.intrinsicElementCount;
};
