import ts from "typescript";

/**
 * Output of a single TypeScript transpile: the stripped `.js` and the
 * isolated-declaration `.d.ts` it produces.
 */
export type TranspiledFile = {
    /** Stripped-types JavaScript output. */
    readonly js: string;
    /** Generated TypeScript declaration output. */
    readonly dts: string;
};

const COMPILER_OPTIONS: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
    declaration: true,
    skipLibCheck: true,
    skipDefaultLibCheck: true,
    removeComments: false,
    sourceMap: false,
    declarationMap: false,
    jsx: ts.JsxEmit.ReactJSX,
    jsxImportSource: "react",
};

/**
 * Transpiles a single TypeScript source string to a `.js` / `.d.ts` pair.
 *
 * Uses `ts.transpileModule` for the JS half (type-stripping only, no
 * type checking) and `ts.transpileDeclaration` for the declaration half
 * (single-file declaration emit). Generated sources annotate every export
 * for isolated-declaration emit, so `transpileDeclaration` always
 * succeeds; an error-category diagnostic from it represents a writer bug
 * and is surfaced rather than swallowed.
 *
 * @param fileName - Source filename, used by TS for path resolution
 * @param source - The TypeScript source string
 */
export const transpileSource = (fileName: string, source: string): TranspiledFile => {
    const jsResult = ts.transpileModule(source, {
        compilerOptions: COMPILER_OPTIONS,
        fileName,
        reportDiagnostics: false,
    });
    const dtsResult = ts.transpileDeclaration(source, {
        compilerOptions: COMPILER_OPTIONS,
        fileName,
    });
    const errorDiagnostics = (dtsResult.diagnostics ?? []).filter(
        (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    if (errorDiagnostics.length > 0) {
        const messages = errorDiagnostics
            .slice(0, 5)
            .map((diagnostic) => {
                const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                if (diagnostic.file && diagnostic.start !== undefined) {
                    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                    return `[${line + 1}:${character + 1}] ${text}`;
                }
                return text;
            })
            .join("\n");
        throw new Error(
            `transpileDeclaration produced ${errorDiagnostics.length} diagnostic(s) for ${fileName}:\n${messages}`,
        );
    }
    return { js: jsResult.outputText, dts: dtsResult.outputText };
};
