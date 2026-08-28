import { errorCode, errorMessage, normalizeError } from "@gtkx/utils";
import { existsSync, mkdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createStagingDir, sweepStrandedDirs } from "./staging.js";

type ProjectFile = {
    fileName: string;
    origin?: string | undefined;
};

type SourceModule = ProjectFile & {
    source: string;
};

type ProjectContext = {
    projectDir: string;
    files: ProjectFile[];
    label: string;
};

type CompileProjectParams = ProjectContext & {
    compilerOptions: Record<string, unknown>;
};

type EmitModulesParams = {
    projectDir: string;
    files: SourceModule[];
    label: string;
};

type DiagnosedFile = {
    fileName: string;
    text: string;
};

type FailedProjectInput = {
    projectDir: string;
    keepAt: string;
    error: unknown;
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

const DECLARATION_EMIT = {
    declaration: true,
    isolatedDeclarations: true,
    removeComments: false,
};

const MODULE_EMIT = {
    removeComments: false,
};

const PURE_ANNOTATION_TEXT = "@__PURE__";
const PURE_ANNOTATION_COMMENT = ` ${PURE_ANNOTATION_TEXT} `;

const DECLARATION_OPTIONS = ts.convertCompilerOptionsFromJson(
    { ...BASE_COMPILER_OPTIONS, ...DECLARATION_EMIT },
    ".",
).options;

const MODULE_OPTIONS = ts.convertCompilerOptionsFromJson(
    { ...BASE_COMPILER_OPTIONS, ...MODULE_EMIT },
    ".",
).options;

const TS_EXTENSION_PATTERN = /\.tsx?$/;
const DECLARATION_EXTENSION = ".d.ts";
const JAVASCRIPT_EXTENSION = ".js";
const CHECK_DIR = ".gtkx-check";
const FAILED_CHECK_DIR = `${CHECK_DIR}.failed`;
const LEGACY_CHECK_PREFIX = `${CHECK_DIR}-`;
const ESM_SCOPE_MANIFEST = `${JSON.stringify({ type: "module" }, null, 4)}\n`;

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

const ensureModuleScope = (projectDir: string): void => {
    try {
        writeFileSync(join(projectDir, "package.json"), ESM_SCOPE_MANIFEST, { flag: "wx" });
    } catch (error) {
        if (errorCode(error) !== "EEXIST") {
            throw error;
        }
    }
};

const isProjectFile = (rel: string): boolean =>
    !rel.startsWith("..") && !isAbsolute(rel) && !rel.split(/[/\\]/).includes("node_modules");

const projectDiagnosticFile = (diagnostic: ts.Diagnostic, projectDir: string): DiagnosedFile | undefined => {
    const { file, start } = diagnostic;

    if (file === undefined || start === undefined) {
        return undefined;
    }

    const fileName = relative(projectDir, file.fileName);

    if (!isProjectFile(fileName)) {
        return undefined;
    }

    const { line, character } = file.getLineAndCharacterOfPosition(start);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");

    return {
        fileName,
        text: `${fileName}:${String(line + 1)}:${String(character + 1)} - ${message} (TS${String(diagnostic.code)})`,
    };
};

const projectDiagnosticFiles = (diagnostics: ts.Diagnostic[], projectDir: string): DiagnosedFile[] => {
    const diagnosed: DiagnosedFile[] = [];

    for (const diagnostic of diagnostics) {
        const entry = projectDiagnosticFile(diagnostic, projectDir);

        if (entry !== undefined) {
            diagnosed.push(entry);
        }
    }

    return diagnosed;
};

const collectOrigins = (files: ProjectFile[]): Map<string, string> => {
    const origins: Map<string, string> = new Map();

    for (const { fileName, origin } of files) {
        if (origin !== undefined) {
            origins.set(fileName, origin);
        }
    }

    return origins;
};

const groupByOrigin = (diagnosed: DiagnosedFile[], origins: Map<string, string>): Map<string, Set<string>> => {
    const grouped: Map<string, Set<string>> = new Map();

    for (const { fileName } of diagnosed) {
        const origin = origins.get(fileName);

        if (origin !== undefined) {
            grouped.set(origin, (grouped.get(origin) ?? new Set<string>()).add(fileName));
        }
    }

    return grouped;
};

const originLines = (diagnosed: DiagnosedFile[], files: ProjectFile[]): string[] =>
    [...groupByOrigin(diagnosed, collectOrigins(files))].map(
        ([origin, generated]) => `Generated from ${origin}: ${[...generated].join(", ")}`,
    );

const diagnosticError = (params: ProjectContext, diagnostics: ts.Diagnostic[]): Error => {
    const diagnosed = projectDiagnosticFiles(diagnostics, params.projectDir);
    const { label } = params;

    if (diagnosed.length === 0) {
        return new Error(`Compiling ${label} failed:\n${ts.formatDiagnostics(diagnostics, FORMAT_HOST).trim()}`);
    }

    const lines = [...diagnosed.map((entry) => entry.text), ...originLines(diagnosed, params.files)];

    return new Error(`Compiling ${label} failed:\n${lines.join("\n")}`);
};

const keepFailedProject = (input: FailedProjectInput): Error => {
    const { projectDir, keepAt, error } = input;

    if (!existsSync(projectDir)) {
        return normalizeError(error);
    }

    rmSync(keepAt, { recursive: true, force: true });
    renameSync(projectDir, keepAt);
    const rebased = errorMessage(error).split(projectDir).join(keepAt);

    return new Error(`${rebased}\nThe generated sources are kept at ${keepAt}, where every path above resolves.`, {
        cause: error,
    });
};

const runProgram = (params: CompileProjectParams): ts.Diagnostic[] => {
    const parsed = ts.parseJsonConfigFileContent(
        {
            compilerOptions: { ...BASE_COMPILER_OPTIONS, ...params.compilerOptions },
            files: params.files.map((file) => `./${file.fileName}`),
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

const replaceExtension = (fileName: string, extension: string): string =>
    `${fileName.replace(TS_EXTENSION_PATTERN, "")}${extension}`;

const transpileOptions = (compilerOptions: ts.CompilerOptions, fileName: string): ts.TranspileOptions => ({
    compilerOptions,
    fileName,
    reportDiagnostics: true,
});

const isPureAnnotated = (text: string, node: ts.Node): boolean =>
    ts.isCallExpression(node) &&
    node.pos >= 0 &&
    (ts.getLeadingCommentRanges(text, node.pos) ?? []).some((range) =>
        text.slice(range.pos, range.end).includes(PURE_ANNOTATION_TEXT),
    );

const dropCommentsExceptPureAnnotations =
    (): ts.TransformerFactory<ts.SourceFile> => (context) => (sourceFile) => {
        const { text } = sourceFile;

        const visit = (node: ts.Node): ts.Node => {
            const isPure = isPureAnnotated(text, node);
            const visited = ts.visitEachChild(node, visit, context);
            ts.setEmitFlags(visited, ts.EmitFlags.NoLeadingComments | ts.EmitFlags.NoTrailingComments);

            if (isPure) {
                ts.addSyntheticLeadingComment(
                    visited,
                    ts.SyntaxKind.MultiLineCommentTrivia,
                    PURE_ANNOTATION_COMMENT,
                    false,
                );
            }

            return visited;
        };

        return ts.visitEachChild(sourceFile, visit, context);
    };

const emitModule = (module: SourceModule, projectDir: string): ts.Diagnostic[] => {
    const fileName = join(projectDir, module.fileName);
    const declaration = ts.transpileDeclaration(module.source, transpileOptions(DECLARATION_OPTIONS, fileName));

    const javascript = ts.transpileModule(module.source, {
        ...transpileOptions(MODULE_OPTIONS, fileName),
        transformers: { after: [dropCommentsExceptPureAnnotations()] },
    });

    const diagnostics = [...declaration.diagnostics ?? [], ...javascript.diagnostics ?? []];

    if (diagnostics.length > 0) {
        return diagnostics;
    }

    writeFileSync(replaceExtension(fileName, DECLARATION_EXTENSION), declaration.outputText);
    writeFileSync(replaceExtension(fileName, JAVASCRIPT_EXTENSION), javascript.outputText);

    return [];
};

const emitModules = (params: EmitModulesParams): void => {
    const diagnostics: ts.Diagnostic[] = [];

    for (const module of params.files) {
        diagnostics.push(...emitModule(module, params.projectDir));
    }

    if (diagnostics.length > 0) {
        throw diagnosticError(params, diagnostics);
    }
};

const compileProject = (params: CompileProjectParams): void => {
    ensureModuleScope(params.projectDir);
    const unlinkToolingModules = linkToolingModules(params.projectDir);

    try {
        const diagnostics = runProgram(params);

        if (diagnostics.length > 0) {
            throw diagnosticError(params, diagnostics);
        }
    } finally {
        unlinkToolingModules();
    }
};

const stageCheckProject = (checkRoot: string): string => {
    const projectDir = createStagingDir(join(checkRoot, CHECK_DIR));
    sweepStrandedDirs(checkRoot, LEGACY_CHECK_PREFIX);

    return projectDir;
};

const checkModules = (params: { modules: SourceModule[]; resolveFrom: string; label: string }): void => {
    const checkRoot = join(params.resolveFrom, "node_modules");
    const projectDir = stageCheckProject(checkRoot);
    const keepAt = join(checkRoot, FAILED_CHECK_DIR);

    try {
        for (const module of params.modules) {
            const filePath = join(projectDir, module.fileName);
            mkdirSync(dirname(filePath), { recursive: true });
            writeFileSync(filePath, module.source);
        }

        compileProject({
            projectDir,
            files: params.modules,
            compilerOptions: CHECK_OPTIONS,
            label: params.label,
        });
    } catch (error) {
        throw keepFailedProject({ projectDir, keepAt, error });
    }

    rmSync(projectDir, { recursive: true, force: true });
    rmSync(keepAt, { recursive: true, force: true });
};

export { checkModules, emitModules, keepFailedProject, type SourceModule };
