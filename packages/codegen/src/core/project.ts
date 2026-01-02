/**
 * ts-morph Project wrapper for code generation.
 *
 * Manages a virtual TypeScript project that can be populated by FFI generators
 * and then read by JSX generators. This enables the hierarchical generation
 * where JSX derives from FFI output.
 */

import { ModuleKind, Project, ScriptTarget, type SourceFile } from "ts-morph";
import { CodegenMetadata } from "./codegen-metadata.js";
import { getBiome } from "./utils/format.js";

/**
 * Wraps a ts-morph Project for code generation.
 *
 * The project holds generated source files in memory. FFI generators
 * populate the project, then JSX generators can read from it.
 *
 * @example
 * ```typescript
 * const project = new CodegenProject();
 *
 * // FFI generator populates the project
 * const buttonFile = project.createSourceFile("gtk/button.ts");
 * buttonFile.addClass({ name: "Button", ... });
 *
 * // JSX generator reads from the project
 * const classInfo = project.getSourceFile("gtk/button.ts");
 * ```
 */
export class CodegenProject {
    private project: Project;
    private readonly _metadata: CodegenMetadata;

    constructor() {
        this.project = new Project({
            compilerOptions: {
                strict: true,
                target: ScriptTarget.ESNext,
                module: ModuleKind.ESNext,
                declaration: true,
                esModuleInterop: true,
                skipLibCheck: true,
            },
            useInMemoryFileSystem: true,
        });
        this._metadata = new CodegenMetadata();
    }

    /**
     * Gets the metadata store for attaching codegen-only data to SourceFiles.
     *
     * Use this to attach/retrieve widget metadata that is needed during generation
     * but should NOT be written to generated files.
     *
     * @example
     * ```typescript
     * // Attach metadata during FFI generation
     * project.metadata.setWidgetMeta(sourceFile, { ... });
     *
     * // Read metadata during React generation
     * const meta = project.metadata.getWidgetMeta(sourceFile);
     * ```
     */
    get metadata(): CodegenMetadata {
        return this._metadata;
    }

    /**
     * Creates a new source file in the project.
     *
     * @param filePath - Relative path for the file (e.g., "gtk/button.ts")
     * @returns The created SourceFile
     */
    createSourceFile(filePath: string): SourceFile {
        return this.project.createSourceFile(filePath, "", { overwrite: true });
    }

    /**
     * Creates a source file in the FFI directory.
     *
     * @param filePath - Path within FFI directory (e.g., "gtk/button.ts")
     * @returns The created SourceFile
     */
    createFfiSourceFile(filePath: string): SourceFile {
        return this.project.createSourceFile(`ffi/${filePath}`, "", { overwrite: true });
    }

    /**
     * Creates a source file in the React directory.
     *
     * @param filePath - Path within React directory (e.g., "internal.ts")
     * @returns The created SourceFile
     */
    createReactSourceFile(filePath: string): SourceFile {
        return this.project.createSourceFile(`react/${filePath}`, "", { overwrite: true });
    }

    /**
     * Gets an existing source file by path.
     *
     * @param filePath - Relative path of the file
     * @returns The SourceFile or null if not found
     */
    getSourceFile(filePath: string): SourceFile | null {
        return this.project.getSourceFile(filePath) ?? null;
    }

    /**
     * Gets all source files in the project.
     */
    getSourceFiles(): SourceFile[] {
        return this.project.getSourceFiles();
    }

    /**
     * Gets all source files in a specific namespace directory.
     *
     * @param namespace - Namespace name (e.g., "gtk", "adw")
     * @returns Source files in that namespace's directory
     */
    getSourceFilesInNamespace(namespace: string): SourceFile[] {
        const nsLower = namespace.toLowerCase();
        return this.project.getSourceFiles().filter((sf) => {
            const path = sf.getFilePath();
            return path.includes(`/${nsLower}/`) || path.startsWith(`${nsLower}/`);
        });
    }

    /**
     * Emits all source files as formatted TypeScript.
     * Uses Biome for fast formatting.
     *
     * @returns Map of file paths to formatted content
     */
    async emit(): Promise<Map<string, string>> {
        const sourceFiles = this.project.getSourceFiles();

        await getBiome();

        const result = new Map<string, string>();
        for (const sourceFile of sourceFiles) {
            const filePath = sourceFile.getFilePath().replace(/^\//, "");
            const content = sourceFile.getFullText();
            const formatted = await this.formatCode(content, filePath);
            result.set(filePath, formatted);
        }

        return result;
    }

    /**
     * Emits all files grouped by type (FFI vs React).
     * Uses Biome for fast formatting.
     *
     * @returns Object with ffi and react Maps of file paths to formatted content
     */
    async emitGrouped(): Promise<{ ffi: Map<string, string>; react: Map<string, string> }> {
        const sourceFiles = this.project.getSourceFiles();

        await getBiome();

        const ffi = new Map<string, string>();
        const react = new Map<string, string>();

        for (const sourceFile of sourceFiles) {
            const fullPath = sourceFile.getFilePath().replace(/^\//, "");
            const content = sourceFile.getFullText();
            const formatted = await this.formatCode(content, fullPath);

            if (fullPath.startsWith("ffi/")) {
                const relativePath = fullPath.slice(4);
                ffi.set(relativePath, formatted);
            } else if (fullPath.startsWith("react/")) {
                const relativePath = fullPath.slice(6);
                react.set(relativePath, formatted);
            }
        }

        return { ffi, react };
    }

    /**
     * Gets the underlying ts-morph Project.
     * Use this for advanced operations not covered by the wrapper.
     */
    getProject(): Project {
        return this.project;
    }

    /**
     * Formats code using Biome.
     */
    private async formatCode(code: string, filePath: string): Promise<string> {
        try {
            const { biome, projectKey } = await getBiome();
            const result = biome.formatContent(projectKey, code, { filePath });
            return result.content;
        } catch (error) {
            console.warn("Failed to format code:", error);
            return code;
        }
    }
}
