import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

type SourceModule = {
    fileName: string;
    source: string;
};

type CompileProjectParams = {
    projectDir: string;
    fileNames: string[];
    compilerOptions: Record<string, unknown>;
    label: string;
};

const BASE_COMPILER_OPTIONS = {
    module: "esnext",
    moduleResolution: "bundler",
    target: "esnext",
    lib: ["esnext"],
    jsx: "react-jsx",
    jsxImportSource: "react",
    customConditions: ["source"],
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    allowUnreachableCode: false,
    allowImportingTsExtensions: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    rewriteRelativeImportExtensions: true,
    skipLibCheck: true,
    types: ["node"],
};

const CHECK_OPTIONS = {
    declaration: true,
    isolatedDeclarations: true,
    noEmit: true,
};

const FORMAT_HOST: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
    getNewLine: () => "\n",
};

const codegenModules = (): string => {
    const sourceDir = dirname(fileURLToPath(import.meta.url));

    return join(dirname(sourceDir), "node_modules");
};

const linkToolingModules = (projectDir: string): (() => void) => {
    const link = join(projectDir, "node_modules");

    if (existsSync(link)) {
        return (): void => undefined;
    }

    symlinkSync(codegenModules(), link, "junction");

    return () => {
        rmSync(link, { force: true });
    };
};

const isProjectFile = (rel: string): boolean =>
    !rel.startsWith("..") && !isAbsolute(rel) && !rel.split(/[/\\]/).includes("node_modules");

const projectDiagnosticLine = (diagnostic: ts.Diagnostic, projectDir: string): string | undefined => {
    const { file, start } = diagnostic;

    if (file === undefined || start === undefined) {
        return undefined;
    }

    const filePath = relative(projectDir, file.fileName);

    if (!isProjectFile(filePath)) {
        return undefined;
    }

    const { line, character } = file.getLineAndCharacterOfPosition(start);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");

    return `${filePath}:${String(line + 1)}:${String(character + 1)} - ${message} (TS${String(diagnostic.code)})`;
};

const projectDiagnosticLines = (diagnostics: ts.Diagnostic[], projectDir: string): string[] => {
    const lines: string[] = [];

    for (const diagnostic of diagnostics) {
        const line = projectDiagnosticLine(diagnostic, projectDir);

        if (line !== undefined) {
            lines.push(line);
        }
    }

    return lines;
};

const diagnosticError = (label: string, projectDir: string, diagnostics: ts.Diagnostic[]): Error => {
    const lines = projectDiagnosticLines(diagnostics, projectDir);

    if (lines.length > 0) {
        return new Error(`Type checking ${label} found ${String(lines.length)} error(s):\n${lines.join("\n")}`);
    }

    return new Error(`Type checking ${label} failed:\n${ts.formatDiagnostics(diagnostics, FORMAT_HOST).trim()}`);
};

const runProgram = (params: CompileProjectParams): ts.Diagnostic[] => {
    const parsed = ts.parseJsonConfigFileContent(
        {
            compilerOptions: { ...BASE_COMPILER_OPTIONS, ...params.compilerOptions },
            files: params.fileNames.map((name) => `./${name}`),
        },
        ts.sys,
        params.projectDir,
    );

    const program = ts.createProgram({
        rootNames: parsed.fileNames,
        options: parsed.options,
        configFileParsingDiagnostics: parsed.errors,
    });

    const diagnostics = ts.getPreEmitDiagnostics(program);

    if (diagnostics.length > 0) {
        return [...diagnostics];
    }

    return [...program.emit().diagnostics];
};

const compileProject = (params: CompileProjectParams): void => {
    const unlinkToolingModules = linkToolingModules(params.projectDir);

    try {
        const diagnostics = runProgram(params);

        if (diagnostics.length > 0) {
            throw diagnosticError(params.label, params.projectDir, diagnostics);
        }
    } finally {
        unlinkToolingModules();
    }
};

const checkModules = (params: { modules: SourceModule[]; resolveFrom: string; label: string }): void => {
    const checkRoot = join(params.resolveFrom, "node_modules");
    mkdirSync(checkRoot, { recursive: true });
    const projectDir = mkdtempSync(join(checkRoot, ".gtkx-check-"));

    try {
        for (const module of params.modules) {
            const filePath = join(projectDir, module.fileName);
            mkdirSync(dirname(filePath), { recursive: true });
            writeFileSync(filePath, module.source);
        }

        compileProject({
            projectDir,
            fileNames: params.modules.map((module) => module.fileName),
            compilerOptions: CHECK_OPTIONS,
            label: params.label,
        });
    } finally {
        rmSync(projectDir, { recursive: true, force: true });
    }
};

export { compileProject, checkModules, type SourceModule, type CompileProjectParams };
