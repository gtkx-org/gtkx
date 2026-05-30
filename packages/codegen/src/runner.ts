import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { generateNamespaceModule } from "./ffi/pipeline.js";
import { loadGirRepository } from "./gir/repository.js";
import { generateReactFiles } from "./react/pipeline.js";
import { transpileSource } from "./transpile.js";

/**
 * Options for {@link CodegenRunner}.
 */
export type CodegenRunnerOptions = {
    /** Resolved `Name-Version` namespace identifiers to generate. */
    readonly libraries: readonly string[];
    /** Directories searched for `.gir` files. */
    readonly girPath: readonly string[];
    /** Optional user slot-prop overrides keyed by JSX element name. */
    readonly slotProps?: Readonly<Record<string, readonly string[]>>;
    /** Absolute directory for the FFI generated `.js`/`.d.ts` files. */
    readonly ffiOutDir: string;
    /** Absolute directory for the React generated files; React is skipped when omitted. */
    readonly reactOutDir?: string;
};

/**
 * Result returned from {@link CodegenRunner.run}.
 */
export type CodegenRunnerResult = {
    /** Number of FFI namespaces produced. */
    readonly namespaces: number;
    /** Number of widget intrinsics emitted into `jsx.ts`. */
    readonly widgets: number;
    /** Wall-clock duration in milliseconds. */
    readonly duration: number;
};

/**
 * Single-entry orchestrator for the GTKX codegen.
 *
 * Loads the GIR repository, runs the FFI pipeline per namespace, runs the
 * React pipeline once, transpiles each generated `.ts` to `.js` plus
 * `.d.ts`, and writes the output trees under `ffiOutDir` (and optionally
 * `reactOutDir`).
 *
 * @example
 * ```ts
 * import { CodegenRunner } from "@gtkx/codegen";
 *
 * await new CodegenRunner({
 *     libraries: ["Gtk-4.0", "Adw-1"],
 *     girPath: ["/usr/share/gir-1.0"],
 *     ffiOutDir: "/abs/path/to/ffi/generated",
 *     reactOutDir: "/abs/path/to/react/generated",
 * }).run();
 * ```
 */
export class CodegenRunner {
    constructor(private readonly options: CodegenRunnerOptions) {}

    /**
     * Executes the full codegen pipeline and writes the output to disk.
     */
    async run(): Promise<CodegenRunnerResult> {
        const start = Date.now();
        const repository = loadGirRepository(this.options.libraries, this.options.girPath);

        const ffiFiles = new Map<string, string>();
        for (const namespace of repository.namespaces.values()) {
            const { path, source } = generateNamespaceModule(namespace, repository);
            ffiFiles.set(path, source);
        }
        writeTree(this.options.ffiOutDir, ffiFiles);

        let widgetCount = 0;
        if (this.options.reactOutDir !== undefined) {
            const reactPipeline = generateReactFiles(repository, this.options.slotProps);
            writeTree(this.options.reactOutDir, reactPipeline.files);
            widgetCount = reactPipeline.widgetCount;
        }

        return {
            namespaces: repository.namespaces.size,
            widgets: widgetCount,
            duration: Date.now() - start,
        };
    }
}

const SOURCE_EXTENSIONS = [".tsx", ".ts"] as const;

const stripSourceExtension = (relativePath: string): string => {
    for (const extension of SOURCE_EXTENSIONS) {
        if (relativePath.endsWith(extension)) {
            return relativePath.slice(0, -extension.length);
        }
    }
    return relativePath;
};

const writeTree = (outDir: string, sources: ReadonlyMap<string, string>): void => {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    for (const [relativePath, source] of sources) {
        const stem = stripSourceExtension(relativePath);
        const { js, dts } = transpileSource(relativePath, source);
        writeOutputFile(outDir, `${stem}.js`, js);
        writeOutputFile(outDir, `${stem}.d.ts`, dts);
    }
};

const writeOutputFile = (root: string, relativePath: string, contents: string): void => {
    const absolute = join(root, relativePath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
};
