import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { baseCompilerOptions } from "./transpile.js";

/**
 * One in-memory source destined for the injected `@gtkx/gi` store, plus whether
 * it is a hand-written overlay (the type-check target) or a generated module
 * declaration (checked against, but not reported on).
 */
export type StoreSourceFile = {
    /** Absolute virtual path of the source, under the store root. */
    readonly path: string;
    /** TypeScript source text (overlay `.ts`) or declaration text (generated `.d.ts`). */
    readonly source: string;
    /** Whether this is a hand-written overlay/augment source. */
    readonly overlay: boolean;
};

const GI_SPECIFIER = "@gtkx/gi/";

const COMPILER_OPTIONS: ts.CompilerOptions = {
    ...baseCompilerOptions(),
    customConditions: ["source"],
    strict: true,
    noEmit: true,
    types: [],
};

/**
 * Source entries the overlay type-check resolves the runtime packages to.
 */
export type RuntimeEntries = {
    /** Absolute path to `@gtkx/ffi`'s source entry (`src/index.ts`). */
    readonly ffiEntry: string;
    /** Absolute path to `@gtkx/native`'s declaration entry (`dist/index.d.ts`). */
    readonly nativeEntry: string;
};

const buildCompilerHost = (
    storeRoot: string,
    virtualSources: ReadonlyMap<string, string>,
    entries: RuntimeEntries,
): ts.CompilerHost => {
    const readSource = (fileName: string): string | undefined =>
        virtualSources.get(fileName) ?? (existsSync(fileName) ? readFileSync(fileName, "utf8") : undefined);

    const resolveInjected = (specifier: string): string | undefined => {
        if (specifier === "@gtkx/ffi") return entries.ffiEntry;
        if (specifier === "@gtkx/native") return entries.nativeEntry;
        if (!specifier.startsWith(GI_SPECIFIER)) return undefined;
        const stem = specifier.slice(GI_SPECIFIER.length).replace(/\.js$/, "");
        return [`${stem}.d.ts`, `${stem}.ts`, `${stem}/index.d.ts`, `${stem}/index.ts`]
            .map((candidate) => join(storeRoot, candidate))
            .find((candidate) => virtualSources.has(candidate));
    };

    const moduleResolutionHost: ts.ModuleResolutionHost = {
        fileExists: (fileName) => virtualSources.has(fileName) || existsSync(fileName),
        readFile: readSource,
    };

    return {
        getSourceFile: (fileName, languageVersion) => {
            const source = readSource(fileName);
            return source === undefined ? undefined : ts.createSourceFile(fileName, source, languageVersion, true);
        },
        getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
        writeFile: () => {},
        getCurrentDirectory: () => storeRoot,
        getCanonicalFileName: (fileName) => fileName,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => "\n",
        fileExists: (fileName) => virtualSources.has(fileName) || existsSync(fileName),
        readFile: readSource,
        resolveModuleNameLiterals: (literals, containingFile, _redirectedReference, options) =>
            literals.map((literal) => {
                const injected = resolveInjected(literal.text);
                if (injected !== undefined) {
                    return { resolvedModule: { resolvedFileName: injected, extension: ts.Extension.Ts } };
                }
                return {
                    resolvedModule: ts.resolveModuleName(literal.text, containingFile, options, moduleResolutionHost)
                        .resolvedModule,
                };
            }),
    };
};

const reportOverlayErrors = (program: ts.Program, overlayPaths: readonly string[], storeRoot: string): void => {
    const errors: ts.Diagnostic[] = [];
    for (const path of overlayPaths) {
        const sourceFile = program.getSourceFile(path);
        if (!sourceFile) continue;
        for (const diagnostic of program.getSemanticDiagnostics(sourceFile)) {
            if (diagnostic.category === ts.DiagnosticCategory.Error) errors.push(diagnostic);
        }
    }
    if (errors.length === 0) return;
    const formatted = ts.formatDiagnosticsWithColorAndContext(errors, {
        getCurrentDirectory: () => storeRoot,
        getCanonicalFileName: (fileName) => fileName,
        getNewLine: () => "\n",
    });
    throw new Error(`Overlay type-check failed against the generated @gtkx/gi API:\n${formatted}`);
};

/**
 * Type-checks the hand-written overlay sources against the freshly generated
 * `@gtkx/gi` declarations, entirely in memory.
 *
 * The overlay augments generated classes (e.g. installs `Value.prototype.getBoxed`),
 * so its correctness is only meaningful relative to the exact API codegen just
 * produced. A {@link ts.Program} is assembled over the in-memory generated
 * declarations and overlay sources, resolving `@gtkx/gi/*` to the generated
 * declarations and `@gtkx/ffi` to its package source; every other specifier
 * (`react`, lib files) resolves from the real filesystem. Semantic errors on the
 * overlay sources abort codegen rather than ship broken bindings.
 *
 * @param storeRoot - Absolute root the virtual source paths are rooted at.
 * @param files - The in-memory generated declarations and overlay sources.
 * @param entries - Absolute source entries for `@gtkx/ffi` and `@gtkx/native`.
 * @throws When any overlay source has a semantic type error.
 */
export const typecheckGiStore = (
    storeRoot: string,
    files: readonly StoreSourceFile[],
    entries: RuntimeEntries,
): void => {
    const overlayPaths = files.filter((file) => file.overlay).map((file) => file.path);
    if (overlayPaths.length === 0) return;
    const virtualSources = new Map(files.map((file) => [file.path, file.source]));
    const host = buildCompilerHost(storeRoot, virtualSources, entries);
    const program = ts.createProgram({ rootNames: files.map((file) => file.path), options: COMPILER_OPTIONS, host });
    reportOverlayErrors(program, overlayPaths, storeRoot);
};
