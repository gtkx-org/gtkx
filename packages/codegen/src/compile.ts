import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const require = createRequire(import.meta.url);

export type SourceModule = {
    fileName: string;
    source: string;
};

export type CompileProjectParams = {
    projectDir: string;
    fileNames: string[];
    compilerOptions: Record<string, unknown>;
    label: string;
    paths?: Record<string, string[]>;
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
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    skipLibCheck: true,
    types: ["node"],
};

const codegenModules = (): string => dirname(dirname(dirname(require.resolve("@types/node/package.json"))));

const linkToolingModules = (projectDir: string): (() => void) => {
    const link = join(projectDir, "node_modules");
    if (existsSync(link)) return () => {};
    symlinkSync(codegenModules(), link, "junction");
    return () => rmSync(link, { force: true });
};

const tscBin = (): string => join(dirname(require.resolve("typescript/package.json")), "bin", "tsc");

const runTsc = (tsconfigPath: string, cwd: string): { code: number; output: string } => {
    try {
        execFileSync(process.execPath, [tscBin(), "--pretty", "false", "-p", tsconfigPath], {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            maxBuffer: 64 * 1024 * 1024,
        });
        return { code: 0, output: "" };
    } catch (error) {
        const {
            status,
            stdout = "",
            stderr = "",
        } = error as { status?: number | null; stdout?: string; stderr?: string };
        return { code: typeof status === "number" ? status : 1, output: `${stdout}\n${stderr}` };
    }
};

const DIAGNOSTIC_LINE = /^(.+?)\((\d+),(\d+)\): error TS(\d+): (.*)$/;

type ProjectDiagnostic = { file: string; line: string; column: string; code: string; message: string };

const parseDiagnostics = (output: string, projectDir: string): ProjectDiagnostic[] => {
    const diagnostics: ProjectDiagnostic[] = [];
    for (const raw of output.split(/\r?\n/)) {
        const match = DIAGNOSTIC_LINE.exec(raw);
        if (match === null) continue;
        const [, filePart, line, column, code, message] = match;
        if (filePart === undefined || line === undefined || column === undefined || code === undefined) continue;
        const file = resolve(projectDir, filePart);
        const rel = relative(projectDir, file);
        if (rel.startsWith("..") || isAbsolute(rel) || rel.split(/[/\\]/).includes("node_modules")) continue;
        diagnostics.push({ file, line, column, code, message: (message ?? "").trim() });
    }
    return diagnostics;
};

const formatDiagnostics = (label: string, projectDir: string, diagnostics: ProjectDiagnostic[]): string => {
    const messages = diagnostics.map(
        (diagnostic) =>
            `${relative(projectDir, diagnostic.file)}:${diagnostic.line}:${diagnostic.column} - ${diagnostic.message} (TS${diagnostic.code})`,
    );
    return `Type checking ${label} found ${diagnostics.length} error(s):\n${messages.join("\n")}`;
};

export const compileProject = (params: CompileProjectParams): void => {
    const tsconfigPath = join(params.projectDir, "tsconfig.json");
    const unlinkToolingModules = linkToolingModules(params.projectDir);
    try {
        writeFileSync(
            tsconfigPath,
            JSON.stringify({
                compilerOptions: {
                    ...BASE_COMPILER_OPTIONS,
                    ...params.compilerOptions,
                    ...(params.paths === undefined ? {} : { paths: params.paths }),
                },
                files: params.fileNames.map((name) => `./${name}`),
            }),
        );
        const { code, output } = runTsc(tsconfigPath, params.projectDir);
        const diagnostics = parseDiagnostics(output, params.projectDir);
        if (diagnostics.length > 0) {
            throw new Error(formatDiagnostics(params.label, params.projectDir, diagnostics));
        }
        if (code !== 0) {
            throw new Error(`Type checking ${params.label} failed:\n${output.trim()}`);
        }
    } finally {
        unlinkToolingModules();
        rmSync(tsconfigPath, { force: true });
    }
};

const CHECK_OPTIONS = {
    declaration: true,
    isolatedDeclarations: true,
    noEmit: true,
};

export const checkModules = (params: { modules: SourceModule[]; resolveFrom: string; label: string }): void => {
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
