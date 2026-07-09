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

export type GlCodegenOptions = {
    registryPath: string;
    overrideExports: Set<string>;
    outputDir: string;
    resolveFrom: string;
};

export type CodegenRunnerOptions = {
    libraries?: string[];
    girPath?: string[];
    elementProps?: Record<string, ElementProp[]> | undefined;
    gi?: GiStoreOptions;
    jsx?: JsxStoreOptions | undefined;
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
