import ts from "typescript";

type TranspiledFile = {
    js: string;
    dts: string;
};

const COMPILER_OPTIONS: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
    skipLibCheck: true,
    jsx: ts.JsxEmit.ReactJSX,
    jsxImportSource: "react",
    declaration: true,
    skipDefaultLibCheck: true,
    removeComments: false,
    sourceMap: false,
    declarationMap: false,
};

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
