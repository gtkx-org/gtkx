import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export type StoreSourceFile = {
    fileName: string;
    source: string;
};

export type TypecheckStoreParams = {
    storeDir: string;
    files: StoreSourceFile[];
    packageName: string;
    exports: Record<string, unknown>;
    resolveFrom: string;
};

const COMPILER_FLAGS = {
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
    skipDefaultLibCheck: true,
    types: ["node"],
    noEmit: true,
};

const selfPaths = (
    packageName: string,
    exportsMap: Record<string, unknown>,
    storeDir: string,
): Record<string, string[]> => {
    const paths: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(exportsMap)) {
        if (key === "./package.json" || typeof value !== "object" || value === null) continue;
        const target = (value as { default?: unknown }).default;
        if (typeof target !== "string") continue;
        const stem = target.replace(/^\.\//, "").replace(/\.js$/, "");
        paths[`${packageName}${key.slice(1)}`] = [join(storeDir, stem)];
    }
    return paths;
};

const require = createRequire(import.meta.url);

const selfTypeRoots = (): string[] => {
    try {
        return [dirname(dirname(require.resolve("@types/node/package.json")))];
    } catch {
        return [];
    }
};

const buildTsconfig = (params: TypecheckStoreParams): string =>
    JSON.stringify({
        compilerOptions: {
            ...COMPILER_FLAGS,
            paths: selfPaths(params.packageName, params.exports, params.storeDir),
            typeRoots: [join(params.resolveFrom, "node_modules", "@types"), ...selfTypeRoots()],
        },
        files: params.files.map((file) => resolve(params.storeDir, file.fileName)),
    });

const linkResolveModules = (storeDir: string, resolveFrom: string): (() => void) => {
    const target = join(resolveFrom, "node_modules");
    const link = join(storeDir, "node_modules");
    if (resolve(storeDir) === resolve(resolveFrom) || existsSync(link) || !existsSync(target)) return () => {};
    symlinkSync(target, link, "junction");
    return () => rmSync(link, { force: true });
};

const tsgoBin = (): string => join(dirname(require.resolve("@typescript/native-preview/package.json")), "bin", "tsgo");

const runTsgo = (tsconfigPath: string, cwd: string): string => {
    try {
        execFileSync(process.execPath, [tsgoBin(), "--noEmit", "--pretty", "false", "-p", tsconfigPath], {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            maxBuffer: 64 * 1024 * 1024,
        });
        return "";
    } catch (error) {
        const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };
        return `${stdout}\n${stderr}`;
    }
};

const DIAGNOSTIC_LINE = /^(.+?)\((\d+),(\d+)\): error TS(\d+): (.*)$/;

type StoreDiagnostic = { file: string; line: string; column: string; code: string; message: string };

const parseStoreDiagnostics = (output: string, storeDir: string): StoreDiagnostic[] => {
    const diagnostics: StoreDiagnostic[] = [];
    for (const raw of output.split(/\r?\n/)) {
        const match = DIAGNOSTIC_LINE.exec(raw);
        if (match === null) continue;
        const [, filePart, line, column, code, message] = match;
        if (filePart === undefined || line === undefined || column === undefined || code === undefined) continue;
        const file = resolve(storeDir, filePart);
        const rel = relative(storeDir, file);
        if (rel.startsWith("..") || isAbsolute(rel) || rel.split(/[/\\]/).includes("node_modules")) continue;
        diagnostics.push({ file, line, column, code, message: (message ?? "").trim() });
    }
    return diagnostics;
};

const formatDiagnostics = (packageName: string, storeDir: string, diagnostics: StoreDiagnostic[]): string => {
    const messages = diagnostics.map(
        (diagnostic) =>
            `${relative(storeDir, diagnostic.file)}:${diagnostic.line}:${diagnostic.column} - ${diagnostic.message} (TS${diagnostic.code})`,
    );
    return `Type checking the generated ${packageName} store found ${diagnostics.length} error(s):\n${messages.join("\n")}`;
};

export const typecheckStore = (params: TypecheckStoreParams): void => {
    const configDir = mkdtempSync(join(tmpdir(), "gtkx-typecheck-"));
    const unlinkResolveModules = linkResolveModules(params.storeDir, params.resolveFrom);
    try {
        const tsconfigPath = join(configDir, "tsconfig.json");
        writeFileSync(tsconfigPath, buildTsconfig(params));
        const diagnostics = parseStoreDiagnostics(runTsgo(tsconfigPath, params.storeDir), params.storeDir);
        if (diagnostics.length > 0) {
            throw new Error(formatDiagnostics(params.packageName, params.storeDir, diagnostics));
        }
    } finally {
        unlinkResolveModules();
        rmSync(configDir, { recursive: true, force: true });
    }
};
